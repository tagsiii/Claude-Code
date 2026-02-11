"""
Navy QOL Chatbot - Conversation logic and response generation.
Retrieves relevant knowledge base entries and formats helpful responses.
"""
import re
from search_engine import search

# Greeting patterns
GREETING_PATTERNS = [
    r"\b(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening))\b",
    r"^(sup|yo|what'?s\s*up)\b",
]

# Topic aliases to expand queries
TOPIC_ALIASES = {
    "pcs": "relocation pcs move permanent change station",
    "bah": "basic allowance housing bah",
    "leave": "annual leave liberty emergency parental",
    "money": "financial budget debt savings pay",
    "pay": "financial pay allowance compensation",
    "kids": "child youth childcare cdc daycare",
    "childcare": "child development center cdc childcare daycare",
    "school": "education tuition assistance college gi bill",
    "college": "education tuition assistance college gi bill navy cool",
    "deploy": "deployment separation reunion family readiness",
    "eval": "evaluation fitrep performance pma",
    "advance": "advancement promotion exam nwae rating",
    "promote": "advancement promotion exam nwae rating",
    "reenlist": "reenlistment srb bonus career waypoints retention",
    "housing": "housing bah quarters barracks oha",
    "medical": "tricare healthcare dental pharmacy medical",
    "health": "tricare healthcare mental health counseling",
    "mental health": "mental health counseling crisis suicide prevention chaplain",
    "suicide": "suicide prevention crisis 988 mental health",
    "abuse": "family advocacy domestic abuse child abuse fap victim",
    "assault": "sexual assault sapr victim advocacy sarc",
    "legal": "legal assistance wills scra power attorney nlso",
    "retire": "transition retirement tap separation va benefits",
    "separate": "transition separation tap career readiness",
    "spouse": "spouse employment career family employment msep",
    "efmp": "exceptional family member program special needs efmp",
    "special needs": "exceptional family member program special needs efmp",
    "drink": "substance abuse alcohol sarp dapa treatment",
    "alcohol": "substance abuse alcohol sarp dapa treatment",
    "drug": "substance abuse drug sarp dapa urinalysis",
    "chaplain": "chaplain religious spiritual confidential credo",
    "mwr": "morale welfare recreation fitness liberty mwr",
    "gym": "morale welfare recreation fitness mwr",
    "recreation": "morale welfare recreation mwr liberty",
}

WELCOME_MSG = (
    "Welcome to the **Navy QOL Assistant**! I'm here to help you find information "
    "about quality of life programs available to Sailors and their families.\n\n"
    "I can help with topics like:\n"
    "- Fleet & Family Support Center services\n"
    "- Leave, pay, and housing (BAH)\n"
    "- Healthcare (TRICARE) and mental health resources\n"
    "- Childcare and youth programs\n"
    "- Education benefits (TA, GI Bill, Navy COOL)\n"
    "- Advancement, evaluations, and career planning\n"
    "- Legal assistance and emergency financial aid\n"
    "- Deployment support and transition assistance\n"
    "- And much more\n\n"
    "**Ask me a question to get started.** For example: *\"What help is available for PCS moves?\"*"
)


def is_greeting(text):
    text_lower = text.strip().lower()
    for pattern in GREETING_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def expand_query(text):
    """Expand user query with known aliases for better search recall."""
    text_lower = text.strip().lower()
    expanded = text_lower
    for alias, expansion in TOPIC_ALIASES.items():
        if alias in text_lower:
            expanded += " " + expansion
    return expanded


def format_response(hits):
    """Format search results into a chatbot-style response."""
    if not hits:
        return (
            "I wasn't able to find a specific match for your question in my knowledge base. "
            "Here are some things you can try:\n\n"
            "- Rephrase your question using different keywords\n"
            "- Ask about a specific program (e.g., FFSC, TRICARE, BAH, TAP)\n"
            "- Type **\"programs\"** to see an overview of all available QOL programs\n"
            "- Type **\"contacts\"** to see key phone numbers and resources\n\n"
            "If this is an emergency, please call the **Military Crisis Line: 988 (press 1)** "
            "or **Military OneSource: 1-800-342-9647**."
        )

    parts = []
    top = hits[0]

    # Lead with the primary answer
    parts.append(f"### {top['title']}\n")
    parts.append(f"{top['content']}\n")
    parts.append(f"*Source: {top['source']}*\n")

    # Add secondary results if relevant
    if len(hits) > 1:
        parts.append("---\n**Related information:**\n")
        for hit in hits[1:3]:
            parts.append(f"- **{hit['title']}** ({hit['category']}): {_summarize(hit['content'])}")

    return "\n".join(parts)


def _summarize(text, max_len=180):
    """Truncate text to a short summary."""
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0] + "..."


def get_response(user_message):
    """Main entry point: take user input and return a chatbot response."""
    text = user_message.strip()

    if not text:
        return WELCOME_MSG

    if is_greeting(text):
        return WELCOME_MSG

    # Check for crisis keywords and always include helpline info
    crisis_keywords = ["suicide", "kill myself", "want to die", "end my life", "crisis", "hurt myself"]
    is_crisis = any(kw in text.lower() for kw in crisis_keywords)

    expanded = expand_query(text)
    hits = search(expanded, limit=5)
    response = format_response(hits)

    if is_crisis:
        crisis_banner = (
            "**If you or someone you know is in crisis, please reach out immediately:**\n"
            "- **Military Crisis Line: 988 (press 1)** or text **838255**\n"
            "- **Military OneSource: 1-800-342-9647** (24/7)\n"
            "- **Safe Helpline: 1-877-995-5247**\n\n"
            "---\n\n"
        )
        response = crisis_banner + response

    return response
