import re

# Read current file
content = open('/app/apps/agents/execution.py').read()

# Remove any broken refresh function at end
cutoff = content.find('\ndef refresh_credentials_if_needed')
if cutoff > 0:
    content = content[:cutoff].rstrip()

# Add correct refresh function
content += '''

def refresh_credentials_if_needed():
    from apps.integrations.models import OrgIntegrationCredential
    from apps.integrations.oauth import refresh_access_token
    from django.utils import timezone
    import datetime
    threshold = timezone.now() + datetime.timedelta(minutes=10)
    expiring = OrgIntegrationCredential.objects.filter(
        is_active=True,
        token_expiry__lt=threshold,
        refresh_token__gt=""
    ).select_related("provider")
    for cred in expiring:
        try:
            refresh_access_token(cred)
        except Exception:
            pass
'''

# Add call inside execute_agent
old = "    extra = dict(extra) if extra else {}  # local copy — we'll pop from it"
new = """    extra = dict(extra) if extra else {}  # local copy — we'll pop from it

    # Proactively refresh expiring tokens before building payload
    try:
        refresh_credentials_if_needed()
    except Exception:
        pass"""

if old in content:
    content = content.replace(old, new, 1)
    print("Call added successfully")
else:
    print("Pattern not found")

open('/app/apps/agents/execution.py', 'w').write(content)
print("File saved. Length:", len(content))
print("Has refresh func:", "def refresh_credentials_if_needed" in content)
print("Has refresh call:", "refresh_credentials_if_needed()" in content)
