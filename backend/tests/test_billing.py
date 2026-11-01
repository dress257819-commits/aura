import base64
import hashlib
import hmac
import time
from datetime import timedelta

import pytest
from fastapi import HTTPException

from lib.plans import appearance_for_plan, effective_plan, limits_for
from models.models import User, utcnow
from routers.billing import (
    _khalti_payment_confirmed,
    _amount_matches,
    _npr_amount,
    _sign_esewa,
    _stripe_signature_valid,
    router,
)
from routers.profiles import sanitize_custom_css


def test_paid_plan_limits_differ_from_free():
    assert limits_for("free")["links"] == 5
    assert limits_for("pro")["links"] == 15
    assert limits_for("creator")["links"] == 100
    assert limits_for("creator")["custom_css"]
    assert not limits_for("free")["custom_css"]


def test_expired_paid_plan_is_effectively_free():
    user = {"plan": "pro", "plan_expires_at": utcnow() - timedelta(seconds=1)}
    assert effective_plan(user) == "free"
    assert effective_plan({"plan": "creator"}) == "creator"


def test_expired_plan_loses_paid_appearance_entitlements():
    appearance = appearance_for_plan(
        {
            "theme": "luxe",
            "font": "playfair",
            "card_style": "outline",
            "glass": 3,
            "custom_css": ".aura-profile { color: red; }",
        },
        "free",
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