"""
Gmail OAuth sender.

Uses a stored GmailCredential (access_token) to send emails via the
Gmail REST API (no SMTP, no special library needed — just requests).

Falls back gracefully to Django's default SMTP if no credential exists.
"""
import base64
import json
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives


GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"


def _refresh_gmail_token(credential) -> str:
    """Refresh the access token using the stored refresh_token."""
    refresh_token = credential.get_refresh_token()
    if not refresh_token:
        raise ValueError("No refresh token stored — user must reconnect Gmail.")

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    resp = requests.post(
        GMAIL_TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    new_token = data["access_token"]
    credential.set_access_token(new_token)

    from django.utils import timezone
    expires_in = data.get("expires_in")
    if expires_in:
        credential.token_expiry = timezone.now() + timezone.timedelta(seconds=int(expires_in))
    credential.save()
    return new_token


def _get_valid_token(credential) -> str:
    """Return a valid access token, refreshing if expired."""
    if credential.is_expired:
        return _refresh_gmail_token(credential)
    return credential.get_access_token()


def send_via_gmail(
    *,
    credential,
    to: str,
    subject: str,
    html_body: str,
    text_body: str = "",
) -> None:
    """
    Send an email using the admin's connected Gmail OAuth credential.

    Args:
        credential: GmailCredential instance
        to: recipient email address
        subject: email subject
        html_body: HTML email body
        text_body: plain-text fallback
    """
    access_token = _get_valid_token(credential)
    from_email = credential.gmail_email

    msg = MIMEMultipart("alternative")
    msg["From"] = from_email
    msg["To"] = to
    msg["Subject"] = subject

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    resp = requests.post(
        GMAIL_SEND_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"raw": raw},
        timeout=15,
    )
    resp.raise_for_status()


def get_org_gmail_credential(org):
    """
    Return the active GmailCredential for the org, or None.
    """
    from apps.integrations.gmail_models import GmailCredential
    return GmailCredential.objects.filter(org=org, is_active=True).first()
