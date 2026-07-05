import os
import smtplib
from email.message import EmailMessage


def smtp_configured():
  return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_FROM"))


def send_otp_email(to_email, otp):
  host = os.environ.get("SMTP_HOST", "")
  port = int(os.environ.get("SMTP_PORT", "587"))
  user = os.environ.get("SMTP_USER", "")
  password = os.environ.get("SMTP_PASSWORD", "")
  from_addr = os.environ.get("SMTP_FROM", user)
  use_tls = os.environ.get("SMTP_USE_TLS", "1") == "1"

  if not host or not from_addr:
    raise RuntimeError("Email is not configured on the server.")

  msg = EmailMessage()
  msg["Subject"] = "JKLU Swap — Your verification code"
  msg["From"] = from_addr
  msg["To"] = to_email
  msg.set_content(
    f"""Hello,

Your JKLU Swap verification code is:

  {otp}

This code expires in 10 minutes. If you did not sign up, you can ignore this email.

— JKLU Swap Team
"""
  )

  with smtplib.SMTP(host, port, timeout=30) as server:
    if use_tls:
      server.starttls()
    if user and password:
      server.login(user, password)
    server.send_message(msg)
