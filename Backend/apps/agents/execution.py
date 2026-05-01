"""
Agent execution layer.

Flow:
  1. Resolve org + credentials for the user
  2. Build full context (agent, tools, conversation history)
  3. Gemini PRE-PROCESSOR — understands intent, extracts params → structured JSON for n8n
  4. n8n EXECUTOR — executes actions using structured JSON
  5. Gemini POST-PROCESSOR — formats raw n8n response into human-friendly reply
  6. Return clean response to frontend
"""
import json
import os
import uuid as uuid_lib

import requests


# Provider type routing
_TRACKER_PROVIDERS = {
    "jira", "trello", "asana", "linear", "monday",
    "clickup", "github", "gitlab", "basecamp",
}
_MESSENGER_PROVIDERS = {
    "slack", "whatsapp", "teams", "discord",
    "telegram", "mattermost", "zoom",
}
_CRM_PROVIDERS = {
    "gohighlevel", "ghl", "hubspot", "salesforce", "zoho", "pipedrive",
}

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


# ── Gemini helpers ────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, api_key: str, max_tokens: int = 500) -> str:
    """Call Gemini Flash and return raw text response."""
    try:
        resp = requests.post(
            f"{_GEMINI_URL}?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": max_tokens},
            },
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return ""


def gemini_preprocess(message: str, agent, conversation_history: list,
                      tracker: str, messenger: str, crm: str,
                      available_projects: list, last_project_key: str,
                      org_name: str, api_key: str) -> dict:
    """
    Brain IN — understands the user message in full context and returns
    a structured JSON payload that n8n uses to execute the right action.
    """
    if not api_key:
        return {}

    system_prompt = agent.system_prompt or f"You are {agent.name}, an AI assistant."

    history_text = ""
    if conversation_history:
        last = conversation_history[-12:]
        history_text = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', m.get('text', ''))}"
            for m in last
        )

    projects_text = ""
    if available_projects:
        projects_text = ", ".join(
            f"{p['name']} ({p['key']})" for p in available_projects[:10]
        )

    tools_text = []
    if tracker:
        tools_text.append(f"tracker={tracker}")
    if messenger:
        tools_text.append(f"messenger={messenger}")
    if crm:
        tools_text.append(f"crm={crm}")

    prompt = f"""You are an AI agent router. Analyze the user message and return ONLY valid JSON.

Agent: {agent.name}
Agent Purpose: {system_prompt}
Organization: {org_name}
Connected Tools: {', '.join(tools_text) or 'none'}
Available Projects/Pipelines: {projects_text or 'none'}
Current Project: {last_project_key or 'none'}

Conversation History (most recent last):
{history_text or 'none'}

User Message: {message}

CONTEXT RESOLUTION RULES (critical — apply before choosing intent):
- If user says "this task", "that task", "it", "the task", "the ticket", "the issue" — scan conversation history for the most recently mentioned task/issue key (e.g. SCRUM-60, PROJ-123, TASK-5) and use it as task_key
- If user says "assign it to X", "assign this to X", "assign to X" — intent=ASSIGN_TASK, use the task key from history, assignee=X
- If user says "try again", "do it again", "retry", "please do it" — look at the last user intent in history and repeat it with the same parameters (intent=RETRY means copy the previous intent exactly)
- If user refers to a person by name only (e.g. "salon gautam", "john") and it is clearly an assignee — set assignee to that full name as-is
- Always resolve "this"/"that"/"it" from history — never ask the user to repeat information already provided

INTENT RULES:
- GENERAL: greetings, thanks, questions about the agent itself, chitchat, anything not requiring a tool action — return this for conversational messages
- LIST_PROJECTS: "what are my projects", "list projects", "show projects", "my projects" — use this for Jira/Trello/Asana/Linear
- CREATE_PIPELINE: ONLY when tracker=gohighlevel/ghl AND message says "create pipeline", "new pipeline", "add pipeline"
- LIST_PIPELINES: ONLY when tracker=gohighlevel/ghl AND message says "list pipelines", "show pipelines", "my pipelines"
- ADD_PIPELINE_STAGE: ONLY when tracker=gohighlevel/ghl AND message says "add stage", "create stage", "new stage in pipeline"
- EDIT_CONTACT: extract contact_name, contact_phone, contact_email. "change phone to X" → contact_phone=X, "update email to X" → contact_email=X
- CREATE_CONTACT: extract contact_name, contact_email, contact_phone
- NEVER use LIST_PIPELINES for Jira/Trello/Asana/Linear — use LIST_PROJECTS instead

Return ONLY this JSON (no markdown, no explanation):
{{
  "intent": "CREATE_TASK|SEARCH_CONTACTS|LIST_PROJECTS|SEARCH_TASKS|UPDATE_TASK|ASSIGN_TASK|CREATE_CONTACT|EDIT_CONTACT|LIST_CONVERSATIONS|SEND_MESSAGE|VIEW_DASHBOARD|TRACK_STATUS|SET_REMINDER|GET_HELP|GENERAL|CREATE_PIPELINE|LIST_PIPELINES|ADD_PIPELINE_STAGE",
  "confidence": 0.95,
  "parameters": {{
    "task_name": null,
    "task_key": null,
    "priority": null,
    "due_date": null,
    "assignee": null,
    "project_key": null,
    "search_query": null,
    "contact_name": null,
    "contact_email": null,
    "contact_phone": null,
    "message_text": null,
    "task_status": null,
    "comment_text": null,
    "pipeline_name": null,
    "pipeline_stages": null,
    "stage_name": null
  }},
  "resolved_project_key": "{last_project_key or ''}",
  "instructions": "brief instruction for n8n on what to do"
}}"""

    raw = _call_gemini(prompt, api_key, max_tokens=500)
    if not raw:
        return {}

    try:
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        match = __import__("re").search(r"\{[\s\S]*\}", cleaned)
        if match:
            return json.loads(match.group(0))
    except Exception:
        pass

    return {}


def gemini_answer_general(message: str, agent, conversation_history: list, api_key: str) -> str:
    """
    Answers general/conversational messages directly with Gemini — no n8n call needed.
    Used when intent=GENERAL or confidence is too low to route to a tool.
    """
    if not api_key:
        return "I'm here to help! What would you like to do?"

    system_prompt = agent.system_prompt or f"You are {agent.name}, a helpful AI assistant."

    history_text = ""
    if conversation_history:
        last = conversation_history[-10:]
        history_text = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', m.get('text', ''))}"
            for m in last
        )

    prompt = f"""You are {agent.name}. {system_prompt}

Conversation so far:
{history_text or 'none'}

User just said: "{message}"

Reply naturally and helpfully. If this is a greeting, greet back warmly.
If they seem to be asking about what you can do, explain your capabilities briefly.
If they are referring to something from the conversation, use that context.
Keep your reply concise (2-4 sentences max). Do not use bullet points unless listing options."""

    return _call_gemini(prompt, api_key, max_tokens=300) or "I'm here to help! What would you like to do?"


def gemini_postprocess(user_message: str, n8n_response: dict, agent,
                       conversation_history: list, api_key: str,
                       ai_intent: str = "", ai_parameters: dict = None,
                       today_date: str = "") -> str:
    """
    Brain OUT — takes raw n8n response and formats it into a clean,
    human-friendly reply. Never filters or modifies the data — n8n already
    returned the right items, this just makes it readable.

    n8n echoes the entire input payload back alongside results. We only
    extract the actual result data (lists + counts + meaningful reply) and
    ignore all echoed input fields to avoid confusing Gemini.
    """
    if not api_key:
        return ""

    data_parts = []

    # 1. Meaningful reply text (skip generic placeholders)
    text_reply = (
        n8n_response.get("reply")
        or n8n_response.get("response")
        or ""
    )
    if text_reply and text_reply.strip().lower() not in (
        "i processed your request.", "done.", "ok.", "success.", ""
    ):
        data_parts.append(f"Message: {text_reply}")

    # 2. Result lists — compact one-line-per-item so 20+ items fit in the prompt
    list_keys = ["tasks", "contacts", "projects", "pipelines", "issues", "items", "results", "data"]
    for key in list_keys:
        val = n8n_response.get(key)
        if val and isinstance(val, list):
            lines = [f"{key.capitalize()} ({len(val)} total):"]
            for item in val:
                if isinstance(item, dict):
                    parts = " | ".join(f"{k}: {v}" for k, v in item.items() if v is not None and v != "")
                    lines.append(f"  - {parts}")
                else:
                    lines.append(f"  - {item}")
            data_parts.append("\n".join(lines))

    # 3. Count fields only (e.g. tasks_count: 20)
    for k in n8n_response:
        if (k.endswith("_count") or k.endswith("Count")) and n8n_response[k]:
            data_parts.append(f"{k}: {n8n_response[k]}")

    # n8n echoes all input fields back — do NOT include them; they pollute
    # the context and cause Gemini to hallucinate wrong answers.

    raw_data = "\n\n".join(data_parts)

    if not raw_data:
        return ""

    if any(x in raw_data.lower() for x in ["traceback", "exception", "error 500"]):
        return "Sorry, something went wrong. Please try again."

    system_prompt = agent.system_prompt or f"You are {agent.name}, a helpful AI assistant."
    prompt = f"""You are {agent.name}. {system_prompt}

The user asked: "{user_message}"

Here is the data the system returned — present ALL of it to the user:
{raw_data[:3500]}

Write a clear, conversational reply directly to the user.
Rules:
- Present EVERY item in the list exactly as returned — do not skip, filter, or omit any
- Keep every task key, ticket number, date, URL, name, and status exactly as given
- Use a clean list format (one item per line with key details) for multiple results
- If the list is empty, say so honestly
- Do not say "the system returned" or reference technical internals
- Do not add your own judgement about which items are relevant
- Address the user directly"""

    refined = _call_gemini(prompt, api_key, max_tokens=1500)
    return refined if refined else raw_data


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_org_for_user(user):
    from django.core.cache import cache

    cache_key = f"org_user_{user.id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    org = None
    try:
        membership = user.org_memberships.select_related("org").get(is_active=True)
        org = membership.org
    except Exception:
        pass

    if not org:
        try:
            org = user.owned_organization
        except Exception:
            pass

    if not org:
        try:
            from apps.agents.group_models import AgentGroupMembership
            group_membership = (
                AgentGroupMembership.objects
                .select_related("group__created_by__owned_organization")
                .filter(user=user, is_active=True, group__is_active=True)
                .first()
            )
            if group_membership and group_membership.group.created_by:
                org = group_membership.group.created_by.owned_organization
        except Exception:
            pass

    # Cache for 5 minutes — org membership rarely changes
    if org is not None:
        cache.set(cache_key, org, timeout=300)
    return org


def _build_tracker_creds(credential) -> dict:
    from apps.integrations.oauth import get_valid_credential

    credential.refresh_from_db()
    credential = get_valid_credential(credential)
    extra = credential.get_extra_data()
    access_token = credential.get_access_token()

    base_url = (
        extra.get("base_url") or extra.get("url")
        or extra.get("site_url") or extra.get("instance_url") or ""
    )
    cloud_id = extra.get("cloud_id", "")

    if access_token and not cloud_id and credential.provider.provider.lower() == "jira":
        try:
            r = requests.get(
                "https://api.atlassian.com/oauth/token/accessible-resources",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                timeout=10,
            )
            r.raise_for_status()
            sites = r.json()
            if isinstance(sites, list) and sites:
                cloud_id = sites[0].get("id", "")
                base_url = sites[0].get("url", "") or base_url
                extra["cloud_id"] = cloud_id
                extra["base_url"] = base_url
                extra["site_name"] = sites[0].get("name", "")
                credential.set_extra_data(extra)
                credential.save(update_fields=["extra_data"])
        except Exception:
            pass

    creds: dict = {}
    if base_url:
        creds["base_url"] = base_url
    if cloud_id:
        creds["cloud_id"] = cloud_id
        creds["jira_api_base"] = f"https://api.atlassian.com/ex/jira/{cloud_id}"
    if access_token:
        creds["auth_header"] = f"Bearer {access_token}"
    if not access_token and extra:
        creds.update(extra)
        api_key = extra.get("api_key", "")
        if api_key:
            creds["auth_header"] = f"Bearer {api_key}"

    return creds


def _build_messenger_creds(credential) -> dict:
    from apps.integrations.oauth import get_valid_credential

    credential = get_valid_credential(credential)
    extra = credential.get_extra_data()
    access_token = credential.get_access_token()

    creds: dict = {}
    if access_token:
        creds["auth_header"] = f"Bearer {access_token}"
    if extra:
        creds.update(extra)
    return creds


def _build_crm_creds(credential) -> dict:
    from apps.integrations.oauth import get_valid_credential

    credential = get_valid_credential(credential)
    extra = credential.get_extra_data()
    access_token = credential.get_access_token()

    creds: dict = {}
    if access_token:
        creds["auth_header"] = f"Bearer {access_token}"
    if extra:
        creds.update(extra)
    return creds


# ── Public API ────────────────────────────────────────────────────────────────

def execute_agent(user, agent, message: str, extra: dict = None) -> dict:
    from apps.integrations.models import OrgIntegrationCredential

    extra = dict(extra) if extra else {}

    # ── Org resolution ────────────────────────────────────────────────────────
    org = _get_org_for_user(user)

    # ── Credential resolution ─────────────────────────────────────────────────
    tracker_name = ""
    tracker_creds: dict = {}
    messenger_name = ""
    messenger_creds: dict = {}
    crm_name = ""
    crm_creds: dict = {}

    if org:
        credentials = (
            OrgIntegrationCredential.objects
            .filter(org=org, provider__agent=agent, is_active=True)
            .select_related("provider")
        )
        for cred in credentials:
            slug = cred.provider.provider.lower()
            if slug in _TRACKER_PROVIDERS and not tracker_name:
                tracker_name = slug
                tracker_creds = _build_tracker_creds(cred)
            elif slug in _MESSENGER_PROVIDERS and not messenger_name:
                messenger_name = slug
                messenger_creds = _build_messenger_creds(cred)
            elif slug in _CRM_PROVIDERS and not crm_name:
                crm_name = "gohighlevel" if slug == "ghl" else slug
                crm_creds = _build_crm_creds(cred)

    # ── Build session context ─────────────────────────────────────────────────
    session_id = extra.pop("sessionId", None) or str(uuid_lib.uuid4())
    conversation_history = extra.pop("conversationHistory", [])
    channel = extra.pop("channel", "web")
    available_projects = extra.pop("available_projects", [])
    last_project_key = extra.pop("last_project_key", "")
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "")

    # ── Gemini PRE-PROCESSOR — Brain IN ───────────────────────────────────────
    ai_context = {}
    try:
        ai_context = gemini_preprocess(
            message=message,
            agent=agent,
            conversation_history=conversation_history,
            tracker=tracker_name,
            messenger=messenger_name,
            crm=crm_name,
            available_projects=available_projects,
            last_project_key=last_project_key,
            org_name=org.name if org else "",
            api_key=gemini_api_key,
        )
    except Exception:
        pass

    # ── Short-circuit: GENERAL intent or very low confidence → answer with Gemini directly ──
    ai_intent = ai_context.get("intent", "")
    ai_confidence = float(ai_context.get("confidence", 1.0))
    if ai_intent == "GENERAL" or ai_confidence < 0.4:
        direct_reply = gemini_answer_general(
            message=message,
            agent=agent,
            conversation_history=conversation_history,
            api_key=gemini_api_key,
        )
        return {
            "success": True,
            "data": {
                "reply": direct_reply,
                "session_id": session_id,
                "intent": "GENERAL",
                "log_id": None,
                "timestamp": None,
            },
        }

    # ── Build n8n payload ─────────────────────────────────────────────────────
    payload = {
        "company_id": str(org.id) if org else "",
        "sessionId": session_id,
        "userId": str(user.id),
        "userName": user.email,
        "userEmail": user.email,
        "channel": channel,
        "message": message,
        "agent_slug": agent.slug,
        "tracker": tracker_name,
        "tracker_creds": tracker_creds,
        "messenger": messenger_name,
        "messenger_creds": messenger_creds,
        "crm": crm_name,
        "crm_creds": crm_creds,
        "gemini_api_key": gemini_api_key,
        "conversationHistory": conversation_history,
        "available_projects": available_projects,
        "last_project_key": last_project_key,
        # AI pre-processed context for n8n
        "ai_intent": ai_context.get("intent", ""),
        "ai_parameters": ai_context.get("parameters", {}),
        "ai_instructions": ai_context.get("instructions", ""),
        "ai_confidence": ai_context.get("confidence", 0),
        "ai_resolved_project_key": ai_context.get("resolved_project_key", last_project_key),
        **extra,
    }

    # ── Pre-save session ──────────────────────────────────────────────────────
    try:
        from apps.organizations.models import AgentSession
        import datetime
        from django.utils import timezone
        AgentSession.objects.update_or_create(
            session_id=session_id,
            defaults={
                "org": org,
                "agent_slug": agent.slug,
                "user_id": str(user.id),
                "user_name": user.email,
                "user_email": user.email,
                "tracker": tracker_name,
                "tracker_creds": tracker_creds,
                "messenger": messenger_name,
                "messenger_creds": messenger_creds,
                "crm": crm_name,
                "crm_creds": crm_creds,
                "gemini_api_key": gemini_api_key,
                "conversation_history": conversation_history,
                "expires_at": timezone.now() + datetime.timedelta(hours=24),
            },
        )
    except Exception:
        pass

    # ── Call n8n webhook ──────────────────────────────────────────────────────
    webhook_url = _get_agent_webhook(agent.slug)
    if not webhook_url:
        return {"success": False, "error": f"No n8n webhook configured for agent '{agent.name}'."}

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-Agent-Secret": os.environ.get("N8N_AGENT_SECRET", ""),
            },
            timeout=120,
        )
        response.raise_for_status()
        try:
            data = response.json()
        except ValueError:
            data = {"response": response.text}

        # ── Gemini POST-PROCESSOR — Brain OUT ─────────────────────────────────
        refined_reply = ""
        try:
            n8n_data = data if isinstance(data, dict) else (data[0] if isinstance(data, list) and data else {})
            refined_reply = gemini_postprocess(
                user_message=message,
                n8n_response=n8n_data,
                agent=agent,
                conversation_history=conversation_history,
                api_key=gemini_api_key,
            )
        except Exception:
            pass

        if refined_reply:
            if isinstance(data, dict):
                data["reply"] = refined_reply
            elif isinstance(data, list) and data:
                data[0]["reply"] = refined_reply

        return {"success": True, "data": data}

    except requests.Timeout:
        return {"success": False, "error": "Agent request timed out."}
    except requests.HTTPError as e:
        return {"success": False, "error": f"Agent error: {e.response.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _get_agent_webhook(slug: str) -> str:
    key = f"N8N_WEBHOOK_{slug.upper().replace('-', '_')}"
    return os.environ.get(key, "")


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
