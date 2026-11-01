"""Plan catalogue and verified checkout integrations for Stripe, eSewa, and Khalti."""

import base64
import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse

from lib.db import db
from lib.session import get_current_user
from models.models import CheckoutCreate, CheckoutResponse, MeProfile, PlanInfo, User, utcnow

router = APIRouter()
logger = logging.getLogger(__name__)

PLAN_DETAILS = {
    "free": {
        "name": "Free",
        "price": 0,
        "tagline": "Your identity, online in minutes.",
        "features": [
            "Beautiful profile with avatar, bio & interests",
            "Up to 5 link cards and 3 gallery items",
            "4 signature themes, 2 fonts, and basic styling",
            "Anonymous messages, public Q&A, and 1 live poll",
            "AI twin with standard answers",
            "Basic analytics",
        ],
    },
    "pro": {
        "name": "Pro",
        "price": 9,
        "tagline": "For creators building an audience.",
        "features": [
            "Everything in Free",
            "Up to 15 link cards and 12 gallery items",
            "Pro themes, fonts, card styles, and stronger glass effects",
            "Profile banner and priority discovery",
            "Verified-style Pro profile badge",
            "14-day analytics, trends, and top-link ranking",
        ],
    },
    "creator": {
        "name": "Creator",
        "price": 29,
        "tagline": "A full studio for your internet identity.",
        "features": [
            "Everything in Pro",
            "Up to 100 link cards and 50 gallery items",
            "Exclusive Luxe theme, premium typography, and custom CSS",
            "AI twin custom instructions and boundaries",
            "1080×1920 Story Studio downloads and sharing",
        ],
    },
}

STRIPE_API = "https://api.stripe.com/v1"
ESEWA_SANDBOX = "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
ESEWA_PRODUCTION = "https://epay.esewa.com.np/api/epay/main/v2/form"
ESEWA_STATUS_SANDBOX = "https://rc.esewa.com.np/api/epay/transaction/status/"
ESEWA_STATUS_PRODUCTION = "https://esewa.com.np/api/epay/transaction/status/"
KHALTI_SANDBOX = "https://dev.khalti.com/api/v2/epayment"
KHALTI_PRODUCTION = "https://khalti.com/api/v2/epayment"


def _npr_amount(usd_amount: int) -> int:
    try:
        rate = Decimal(os.environ.get("NPR_PER_USD", "135"))
    except InvalidOperation as exc:
        raise HTTPException(status_code=503, detail="NPR_PER_USD must be a valid number") from exc
    if not rate.is_finite() or rate <= 0:
        raise HTTPException(status_code=503, detail="NPR_PER_USD must be greater than zero")
    return int((Decimal(usd_amount) * rate).quantize(Decimal("1")))


def _frontend_url(path: str) -> str:
    return f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}{path}"


def _stripe_price_id(plan: str) -> str:
    price_id = os.environ.get(f"STRIPE_PRICE_{plan.upper()}")
    if not os.environ.get("STRIPE_SECRET_KEY") or not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe checkout is not configured for {plan}. Set the Stripe secret and recurring price ID.",
        )
    return price_id


def _esewa_urls() -> tuple[str, str]:
    if os.environ.get("ESEWA_ENV", "sandbox").lower() == "production":
        return ESEWA_PRODUCTION, ESEWA_STATUS_PRODUCTION
    return ESEWA_SANDBOX, ESEWA_STATUS_SANDBOX


def _khalti_base() -> str:
    if os.environ.get("KHALTI_ENV", "sandbox").lower() == "production":
        return KHALTI_PRODUCTION
    return KHALTI_SANDBOX


def _sign_esewa(fields: dict[str, str], secret: str) -> str:
    signed_fields = fields["signed_field_names"].split(",")
    message = ",".join(f"{key}={fields[key]}" for key in signed_fields)
    digest = hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def _khalti_payment_confirmed(result: dict, order: dict, pidx: str) -> bool:
    return (
        result.get("status") == "Completed"
        and result.get("pidx") == pidx
        and _amount_matches(result.get("total_amount"), order["amount"] * 100)
        and result.get("refunded") is not True
    )


def _amount_matches(actual, expected: int) -> bool:
    try:
        return Decimal(str(actual).replace(",", "")) == Decimal(expected)
    except InvalidOperation:
        return False


async def _provider_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, str] | None = None,
    data: dict[str, str] | None = None,
    json_body: dict | None = None,
) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.request(
                method, url, headers=headers, params=params, data=data, json=json_body
            )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Payment provider request failed: %s %s", method, url)
        raise HTTPException(
            status_code=502, detail="Payment provider could not be reached. Please try again."
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Payment provider returned an invalid response")
    return payload


async def _activate_order(order: dict, expires_at=None) -> None:
    if order["status"] == "paid":
        return
    now = utcnow()
    user = await db.users.find_one({"id": order["user_id"]})
    if expires_at is None:
        previous_expiry = user.get("plan_expires_at") if user else None
        if previous_expiry and previous_expiry.tzinfo is None:
            from datetime import timezone

            previous_expiry = previous_expiry.replace(tzinfo=timezone.utc)
        if (
            user
            and user.get("plan") == order["plan"]
            and previous_expiry
            and previous_expiry > now
        ):
            expires_at = previous_expiry + timedelta(days=30)
        else:
            expires_at = now + timedelta(days=30)
    await db.users.update_one(
        {"id": order["user_id"]},
        {"$set": {"plan": order["plan"], "plan_expires_at": expires_at}},
    )
    await db.payments.update_one(
        {"id": order["id"], "status": "pending"},
        {"$set": {"status": "paid", "paid_at": now, "expires_at": expires_at}},
    )


async def _stripe_session(session_id: str) -> dict:
    secret = os.environ.get("STRIPE_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe checkout is not configured")
    return await _provider_json(
        "GET",
        f"{STRIPE_API}/checkout/sessions/{session_id}",
        headers={"Authorization": f"Bearer {secret}"},
    )


async def _activate_stripe_session(session: dict) -> None:
    metadata = session.get("metadata") or {}
    payment_id = metadata.get("payment_id")
    if (
        session.get("mode") != "subscription"
        or session.get("status") != "complete"
        or session.get("payment_status") != "paid"
        or not payment_id
    ):
        raise HTTPException(status_code=402, detail="Stripe has not confirmed this payment")

    order = await db.payments.find_one({"id": payment_id, "provider": "stripe"})
    if (
        not order
        or order["user_id"] != metadata.get("user_id")
        or order["plan"] != metadata.get("plan")
        or order.get("checkout_session_id") != session.get("id")
    ):
        raise HTTPException(status_code=400, detail="Payment does not match this checkout")

    subscription_id = session.get("subscription")
    if not isinstance(subscription_id, str):
        raise HTTPException(status_code=402, detail="Stripe subscription is not active")
    secret = os.environ.get("STRIPE_SECRET_KEY")
    subscription = await _provider_json(
        "GET",
        f"{STRIPE_API}/subscriptions/{subscription_id}",
        headers={"Authorization": f"Bearer {secret}"},
    )
    if subscription.get("status") not in {"active", "trialing"}:
        raise HTTPException(status_code=402, detail="Stripe subscription is not active")

    period_end = subscription.get("current_period_end")
    expires_at = None
    if isinstance(period_end, int):
        from datetime import datetime, timezone

        expires_at = datetime.fromtimestamp(period_end, timezone.utc)
    await _activate_order(order, expires_at)
    await db.users.update_one(
        {"id": order["user_id"]},
        {"$set": {"stripe_subscription_id": subscription_id}},
    )
    await db.payments.update_one(
        {"id": order["id"]}, {"$set": {"subscription_id": subscription_id}}
    )


def _stripe_signature_valid(raw_body: bytes, signature_header: str, secret: str) -> bool:
    timestamp = None
    signatures = []
    for item in signature_header.split(","):
        key, separator, value = item.partition("=")
        if not separator:
            continue
        if key == "t":
            timestamp = value
        elif key == "v1":
            signatures.append(value)
    if not timestamp or not signatures:
        return False
    try:
        timestamp_value = int(timestamp)
    except ValueError:
        return False
    if abs(int(utcnow().timestamp()) - timestamp_value) > 300:
        return False
    signed_payload = f"{timestamp}.{raw_body.decode()}".encode()
    expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, signature) for signature in signatures)


@router.get("/plans", response_model=list[PlanInfo])
async def list_plans():
    return [
        PlanInfo(
            key=key,
            name=plan["name"],
            price=plan["price"],
            nepal_price=_npr_amount(plan["price"]),
            tagline=plan["tagline"],
            features=plan["features"],
        )
        for key, plan in PLAN_DETAILS.items()
    ]


@router.get("/billing/options")
async def billing_options():
    return {
        "international": {
            "stripe": bool(
                os.environ.get("STRIPE_SECRET_KEY")
                and os.environ.get("STRIPE_PRICE_PRO")
                and os.environ.get("STRIPE_PRICE_CREATOR")
            )
        },
        "nepal": {
            "esewa": bool(os.environ.get("ESEWA_PRODUCT_CODE") and os.environ.get("ESEWA_SECRET_KEY")),
            "khalti": bool(os.environ.get("KHALTI_SECRET_KEY")),
        },
    }


@router.post("/me/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(input: CheckoutCreate, user: User = Depends(get_current_user)):
    if input.region == "international" and input.provider != "stripe":
        raise HTTPException(status_code=422, detail="Choose Stripe for international checkout")
    if input.region == "nepal" and input.provider == "stripe":
        raise HTTPException(status_code=422, detail="Choose eSewa or Khalti for Nepal checkout")
    if user.plan != "free" and (input.provider == "stripe" or user.stripe_subscription_id):
        raise HTTPException(
            status_code=409,
            detail="Cancel your current premium plan before starting another Stripe subscription",
        )

    plan = PLAN_DETAILS[input.plan]
    amount = plan["price"] if input.region == "international" else _npr_amount(plan["price"])
    currency = "USD" if input.region == "international" else "NPR"
    payment_id = str(uuid.uuid4())
    order = {
        "id": payment_id,
        "user_id": user.id,
        "plan": input.plan,
        "region": input.region,
        "provider": input.provider,
        "amount": amount,
        "currency": currency,
        "status": "pending",
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(hours=2),
    }

    if input.provider == "stripe":
        price_id = _stripe_price_id(input.plan)
        secret = os.environ["STRIPE_SECRET_KEY"]
        configured_price = await _provider_json(
            "GET",
            f"{STRIPE_API}/prices/{price_id}",
            headers={"Authorization": f"Bearer {secret}"},
        )
        recurring = configured_price.get("recurring") or {}
        if (
            configured_price.get("active") is not True
            or configured_price.get("currency") != "usd"
            or configured_price.get("unit_amount") != plan["price"] * 100
            or recurring.get("interval") != "month"
        ):
            raise HTTPException(
                status_code=503,
                detail=f"Configured Stripe price for {input.plan} must be active, monthly, and match the USD plan price.",
            )
        await db.payments.insert_one(order)
        session = await _provider_json(
            "POST",
            f"{STRIPE_API}/checkout/sessions",
            headers={"Authorization": f"Bearer {secret}"},
            data={
                "mode": "subscription",
                "line_items[0][price]": price_id,
                "line_items[0][quantity]": "1",
                "success_url": _frontend_url("/billing/complete?session_id={CHECKOUT_SESSION_ID}"),
                "cancel_url": _frontend_url("/pricing?checkout=cancel"),
                "client_reference_id": user.id,
                "metadata[payment_id]": payment_id,
                "metadata[user_id]": user.id,
                "metadata[plan]": input.plan,
                "subscription_data[metadata][payment_id]": payment_id,
                "subscription_data[metadata][user_id]": user.id,
                "subscription_data[metadata][plan]": input.plan,
            },
        )
        if not session.get("id") or not session.get("url"):
            await db.payments.update_one(
                {"id": payment_id}, {"$set": {"status": "failed"}}
            )
            raise HTTPException(status_code=502, detail="Stripe did not create a checkout session")
        await db.payments.update_one(
            {"id": payment_id},
            {"$set": {"checkout_session_id": session["id"]}},
        )
        return CheckoutResponse(
            payment_id=payment_id, provider="stripe", checkout_url=session["url"]
        )

    if input.provider == "esewa":
        product_code = os.environ.get("ESEWA_PRODUCT_CODE")
        secret = os.environ.get("ESEWA_SECRET_KEY")
        if not product_code or not secret:
            raise HTTPException(status_code=503, detail="eSewa checkout is not configured")
        form_url, _ = _esewa_urls()
        callback_url = f"{os.environ.get('BACKEND_PUBLIC_URL', 'http://localhost:8001').rstrip('/')}/api/billing/payments/esewa/complete"
        fields = {
            "amount": f"{amount}.00",
            "tax_amount": "0",
            "total_amount": f"{amount}.00",
            "transaction_uuid": payment_id,
            "product_code": product_code,
            "product_service_charge": "0",
            "product_delivery_charge": "0",
            "success_url": callback_url,
            "failure_url": _frontend_url("/pricing?checkout=cancel"),
            "signed_field_names": "total_amount,transaction_uuid,product_code",
        }
        fields["signature"] = _sign_esewa(fields, secret)
        await db.payments.insert_one(order)
        return CheckoutResponse(
            payment_id=payment_id,
            provider="esewa",
            checkout_url=form_url,
            form_fields=fields,
        )

    secret = os.environ.get("KHALTI_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Khalti checkout is not configured")
    await db.payments.insert_one(order)
    khalti = await _provider_json(
        "POST",
        f"{_khalti_base()}/initiate/",
        headers={"Authorization": f"Key {secret}"},
        json_body={
            "return_url": f"{os.environ.get('BACKEND_PUBLIC_URL', 'http://localhost:8001').rstrip('/')}/api/billing/payments/khalti/complete",
            "website_url": os.environ.get("FRONTEND_URL", "http://localhost:3000"),
            "amount": amount * 100,
            "purchase_order_id": payment_id,
            "purchase_order_name": f"AURA {plan['name']} 30-day access",
            "customer_info": {"name": user.name, "email": user.email},
        },
    )
    if not khalti.get("pidx") or not khalti.get("payment_url"):
        await db.payments.update_one({"id": payment_id}, {"$set": {"status": "failed"}})
        raise HTTPException(status_code=502, detail="Khalti did not create a checkout session")
    await db.payments.update_one(
        {"id": payment_id}, {"$set": {"provider_ref": khalti["pidx"]}}
    )
    return CheckoutResponse(
        payment_id=payment_id,
        provider="khalti",
        checkout_url=khalti["payment_url"],
    )


@router.post("/me/billing/confirm", response_model=MeProfile)
async def confirm_stripe_checkout(
    session_id: str,
    user: User = Depends(get_current_user),
):
    session = await _stripe_session(session_id)
    metadata = session.get("metadata") or {}
    if metadata.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="This checkout belongs to another account")
    await _activate_stripe_session(session)
    doc = await db.users.find_one({"id": user.id})
    return MeProfile(**doc)


@router.post("/me/billing/downgrade", response_model=MeProfile)
async def downgrade(user: User = Depends(get_current_user)):
    doc = await db.users.find_one({"id": user.id})
    subscription_id = doc.get("stripe_subscription_id") if doc else None
    if subscription_id:
        secret = os.environ.get("STRIPE_SECRET_KEY")
        if not secret:
            raise HTTPException(status_code=503, detail="Unable to cancel the Stripe subscription")
        await _provider_json(
            "DELETE",
            f"{STRIPE_API}/subscriptions/{subscription_id}",
            headers={"Authorization": f"Bearer {secret}"},
        )
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"plan": "free"}, "$unset": {
            "plan_expires_at": "", "stripe_subscription_id": "",
        }},
    )
    fresh = await db.users.find_one({"id": user.id})
    return MeProfile(**fresh)


@router.post("/billing/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(default="", alias="Stripe-Signature"),
):
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe webhooks are not configured")
    raw_body = await request.body()
    if not _stripe_signature_valid(raw_body, stripe_signature, secret):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe event") from exc

    event_type = event.get("type")
    resource = (event.get("data") or {}).get("object") or {}
    if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        session = await _stripe_session(resource.get("id", ""))
        await _activate_stripe_session(session)
    elif event_type == "invoice.paid":
        subscription_id = resource.get("subscription")
        if subscription_id:
            subscription = await _provider_json(
                "GET",
                f"{STRIPE_API}/subscriptions/{subscription_id}",
                headers={"Authorization": f"Bearer {os.environ.get('STRIPE_SECRET_KEY', '')}"},
            )
            metadata = subscription.get("metadata") or {}
            payment_id = metadata.get("payment_id")
            order = await db.payments.find_one({"id": payment_id, "provider": "stripe"})
            if order and subscription.get("status") in {"active", "trialing"}:
                from datetime import datetime, timezone

                period_end = subscription.get("current_period_end")
                if isinstance(period_end, int):
                    expires_at = datetime.fromtimestamp(period_end, timezone.utc)
                    await db.users.update_one(
                        {"id": order["user_id"]},
                        {"$set": {
                            "plan": order["plan"],
                            "plan_expires_at": expires_at,
                            "stripe_subscription_id": subscription_id,
                        }},
                    )
                    await db.payments.update_one(
                        {"id": order["id"]},
                        {"$set": {"status": "paid", "expires_at": expires_at}},
                    )
    elif event_type == "customer.subscription.deleted":
        subscription_id = resource.get("id")
        metadata = resource.get("metadata") or {}
        payment_id = metadata.get("payment_id")
        order = await db.payments.find_one({"id": payment_id, "provider": "stripe"})
        if order:
            await db.users.update_one(
                {"id": order["user_id"], "stripe_subscription_id": subscription_id},
                {"$set": {"plan": "free"}, "$unset": {
                    "plan_expires_at": "", "stripe_subscription_id": "",
                }},
            )
    return {"received": True}


@router.get("/billing/payments/esewa/complete")
async def complete_esewa_payment(data: str = ""):
    if not data:
        return RedirectResponse(_frontend_url("/billing/complete?status=failed"))
    try:
        padded = data + "=" * (-len(data) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(padded).decode())
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid eSewa payment response") from exc
    if not isinstance(decoded, dict):
        raise HTTPException(status_code=400, detail="Invalid eSewa payment response")
    secret = os.environ.get("ESEWA_SECRET_KEY")
    signed_field_names = decoded.get("signed_field_names", "")
    signature = decoded.get("signature", "")
    if not isinstance(signed_field_names, str) or not isinstance(signature, str):
        raise HTTPException(status_code=400, detail="Invalid eSewa payment response")
    signed_fields = signed_field_names.split(",")
    if not secret or not signed_fields or not signature:
        raise HTTPException(status_code=400, detail="Unsigned eSewa payment response")
    fields = {key: str(decoded.get(key, "")) for key in signed_fields}
    fields["signed_field_names"] = ",".join(signed_fields)
    if not hmac.compare_digest(_sign_esewa(fields, secret), signature):
        raise HTTPException(status_code=400, detail="Invalid eSewa payment signature")

    order = await db.payments.find_one({
        "id": decoded.get("transaction_uuid"),
        "provider": "esewa",
    })
    product_code = os.environ.get("ESEWA_PRODUCT_CODE")
    if (
        not order
        or decoded.get("status") != "COMPLETE"
        or decoded.get("product_code") != product_code
        or not _amount_matches(decoded.get("total_amount"), order["amount"])
    ):
        return RedirectResponse(_frontend_url("/billing/complete?status=failed"))
    _, status_url = _esewa_urls()
    status = await _provider_json(
        "GET",
        status_url,
        params={
            "product_code": product_code or "",
            "total_amount": str(order["amount"]),
            "transaction_uuid": order["id"],
        },
    )
    if (
        status.get("status") != "COMPLETE"
        or str(status.get("transaction_uuid")) != order["id"]
        or status.get("product_code") != product_code
        or not _amount_matches(status.get("total_amount"), order["amount"])
    ):
        return RedirectResponse(_frontend_url("/billing/complete?status=failed"))
    await _activate_order(order)
    return RedirectResponse(_frontend_url("/billing/complete?status=success"))


@router.get("/billing/payments/khalti/complete")
async def complete_khalti_payment(pidx: str = "", purchase_order_id: str = ""):
    order = await db.payments.find_one({
        "id": purchase_order_id,
        "provider": "khalti",
        "provider_ref": pidx,
    })
    secret = os.environ.get("KHALTI_SECRET_KEY")
    if not order or not secret or not pidx:
        return RedirectResponse(_frontend_url("/billing/complete?status=failed"))
    result = await _provider_json(
        "POST",
        f"{_khalti_base()}/lookup/",
        headers={"Authorization": f"Key {secret}"},
        json_body={"pidx": pidx},
    )
    if not _khalti_payment_confirmed(result, order, pidx):
        return RedirectResponse(_frontend_url("/billing/complete?status=failed"))
    await _activate_order(order)
    return RedirectResponse(_frontend_url("/billing/complete?status=success"))
