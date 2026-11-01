import base64
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from lib.plans import (
    appearance_for_plan,
    effective_plan,
    free_access_active,
    limits_for,
)
from models.models import CheckoutCreate, User, utcnow
from routers.billing import (
    _khalti_payment_confirmed,
    _amount_matches,
    create_checkout,
    list_plans,
    _npr_amount,
    _sign_esewa,
    _stripe_signature_valid,
    router,
)
from routers.profiles import sanitize_custom_css


PROMOTION_END = datetime(2026, 12, 1, 16, 36, 13, 739000, tzinfo=timezone.utc)


def test_all_features_are_free_during_the_30_day_promotion(monkeypatch):
    monkeypatch.setenv("AURA_FREE_ACCESS_END", PROMOTION_END.isoformat())
    assert free_access_active(PROMOTION_END - timedelta(seconds=1))
    for plan in ("free", "pro", "creator"):
        limits = limits_for(plan, PROMOTION_END - timedelta(seconds=1))
        assert limits["links"] == 100
        assert limits["gallery"] == 50
        assert limits["custom_css"]
        assert limits["ai_customization"]
        assert effective_plan({"plan": plan}, PROMOTION_END - timedelta(seconds=1)) == "creator"


@pytest.mark.parametrize(
    ("plan", "expected_links", "expected_gallery", "expected_css"),
    [("free", 5, 3, False), ("pro", 15, 12, False), ("creator", 100, 50, True)],
)
def test_original_plan_limits_resume_after_promotion(
    monkeypatch, plan, expected_links, expected_gallery, expected_css
):
    monkeypatch.setenv("AURA_FREE_ACCESS_END", PROMOTION_END.isoformat())
    assert not free_access_active(PROMOTION_END)
    limits = limits_for(plan, PROMOTION_END)
    assert limits["links"] == expected_links
    assert limits["gallery"] == expected_gallery
    assert limits["custom_css"] is expected_css


def test_expired_paid_plan_is_free_after_promotion(monkeypatch):
    monkeypatch.setenv("AURA_FREE_ACCESS_END", PROMOTION_END.isoformat())
    user = {"plan": "pro", "plan_expires_at": PROMOTION_END - timedelta(seconds=1)}
    assert effective_plan(user, PROMOTION_END) == "free"
    assert effective_plan({"plan": "creator"}, PROMOTION_END) == "creator"


def test_paid_appearance_entitlements_resume_after_promotion(monkeypatch):
    monkeypatch.setenv("AURA_FREE_ACCESS_END", PROMOTION_END.isoformat())
    appearance = appearance_for_plan(
        {
            "theme": "luxe",
            "font": "playfair",
            "card_style": "outline",
            "glass": 3,
            "custom_css": ".aura-profile { color: red; }",
        },
        "free",
        PROMOTION_END,
    )
    assert appearance == {
        "theme": "minimal",
        "font": "jakarta",
        "card_style": "rounded",
        "glass": 2,
        "custom_css": "",
    }


def test_checkout_has_no_instant_upgrade_endpoint():
    paths = {route.path for route in router.routes}
    assert "/me/upgrade" not in paths
    assert "/me/billing/checkout" in paths
    assert "/me/billing/confirm" in paths


async def test_checkout_is_disabled_during_promotion(monkeypatch):
    monkeypatch.setattr("routers.billing.free_access_active", lambda: True)
    user = User(email="free@example.com", username="freeuser", name="Free")
    with pytest.raises(HTTPException) as error:
        await create_checkout(
            CheckoutCreate(plan="pro", region="nepal", provider="esewa"),
            user,
        )
    assert error.value.status_code == 503
    assert "30-day" in error.value.detail


async def test_promotion_plan_catalogue_has_one_free_all_access_plan(monkeypatch):
    monkeypatch.setattr("routers.billing.free_access_active", lambda: True)
    plans = await list_plans()
    assert len(plans) == 1
    assert plans[0].key == "free"
    assert plans[0].price == 0
    assert plans[0].promotion_active
    assert any("Verified blue tick" in feature for feature in plans[0].features)


async def test_paid_plans_return_after_promotion(monkeypatch):
    monkeypatch.setattr("routers.billing.free_access_active", lambda: False)
    monkeypatch.setenv("NPR_PER_USD", "135")
    plans = await list_plans()
    assert [plan.key for plan in plans] == ["free", "pro", "creator"]
    assert all(not plan.promotion_active for plan in plans)


def test_npr_monthly_price_uses_configured_rate(monkeypatch):
    monkeypatch.setenv("NPR_PER_USD", "135")
    assert _npr_amount(9) == 1215
    assert _npr_amount(29) == 3915


def test_npr_price_rejects_invalid_exchange_rate(monkeypatch):
    monkeypatch.setenv("NPR_PER_USD", "0")
    with pytest.raises(HTTPException) as error:
        _npr_amount(9)
    assert error.value.status_code == 503


def test_esewa_signature_covers_signed_checkout_fields():
    fields = {
        "total_amount": "1215.00",
        "transaction_uuid": "order-id",
        "product_code": "merchant",
        "signed_field_names": "total_amount,transaction_uuid,product_code",
    }
    signature = _sign_esewa(fields, "test-secret")
    expected = base64.b64encode(
        hmac.new(
            b"test-secret",
            b"total_amount=1215.00,transaction_uuid=order-id,product_code=merchant",
            hashlib.sha256,
        ).digest()
    ).decode()
    assert signature == expected


def test_khalti_uses_lookup_response_fields_for_verification():
    order = {"amount": 1215, "id": "order-id"}
    assert _khalti_payment_confirmed(
        {"pidx": "pidx-123", "total_amount": 121500, "status": "Completed"},
        order,
        "pidx-123",
    )
    assert not _khalti_payment_confirmed(
        {"pidx": "pidx-123", "total_amount": 121500, "status": "Pending"},
        order,
        "pidx-123",
    )


def test_esewa_amounts_allow_provider_decimal_and_grouped_formats():
    assert _amount_matches("1,215.0", 1215)
    assert _amount_matches(1215, 1215)
    assert not _amount_matches("1214.99", 1215)


def test_stripe_webhook_signature_is_verified():
    body = b'{"type":"checkout.session.completed"}'
    secret = "whsec_test"
    timestamp = str(int(time.time()))
    digest = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    assert _stripe_signature_valid(body, f"t={timestamp},v1={digest}", secret)
    assert not _stripe_signature_valid(body, f"t={timestamp},v1=invalid", secret)


def test_custom_css_accepts_scoped_safe_rules():
    css = ".aura-profile { color: #f5f3ff; }\n.aura-profile .aura-link-card { border-radius: 24px; }"
    assert sanitize_custom_css(css) == (
        ".aura-profile {color: #f5f3ff}\n"
        ".aura-profile .aura-link-card {border-radius: 24px}"
    )


@pytest.mark.parametrize(
    "css",
    [
        "body { color: red; }",
        ".aura-profile { background-color: url(https://example.com/image); }",
        ".aura-profile { position: fixed; }",
        ".aura-profile { color: red; } <script>alert(1)</script>",
    ],
)
def test_custom_css_rejects_unscoped_or_unsafe_rules(css):
    with pytest.raises(HTTPException) as error:
        sanitize_custom_css(css)
    assert error.value.status_code == 422