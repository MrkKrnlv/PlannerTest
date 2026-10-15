"""Собирает n8n/voice-to-planner.json — импортируемый воркфлоу.
Запуск: python3 scripts/build-n8n-workflow.py"""
import json, uuid
from pathlib import Path

APP = "https://YOUR-APP.pages.dev"  # заменить после деплоя
OUT = Path(__file__).resolve().parent.parent / "n8n" / "voice-to-planner.json"

SCHEMA = {
    "type": "object",
    "properties": {
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Коротко, с глагола: «Позвонить Ане»"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "time": {"type": ["string", "null"], "description": "HH:MM, только если время названо"},
                    "duration_min": {"type": "integer", "description": "Оценка в минутах, кратно 5"},
                    "slot": {"type": "string", "enum": ["morning", "afternoon", "evening", "anytime"]},
                    "area": {"type": ["string", "null"], "description": "работа, учёба, дом, здоровье, клиенты"},
                    "priority": {"type": "integer", "minimum": 1, "maximum": 3},
                },
                "required": ["title", "date", "duration_min", "slot", "priority"],
            },
        },
        "summary": {"type": "string", "description": "1–3 предложения пользователю: что и куда добавлено"},
    },
    "required": ["tasks", "summary"],
}

SYSTEM = """Ты — ассистент-планировщик. Из сообщения пользователя (часто это расшифровка голосового, с ошибками распознавания) извлекаешь задачи для планера.

Правила:
- Дата: если не названа — сегодня. «Завтра», «в пятницу», «на выходных» переводи в конкретную ближайшую будущую дату.
- time ставь только если время названо явно. slot: morning до 12:00, afternoon 12–17, evening после 17. Если неясно — anytime.
- duration_min: если длительность не сказана, оцени реалистично и кратно 5 (звонок 15–30, встреча 60, монтаж/код/учёба 90–180, бытовая мелочь 10–20).
- Размытую большую задачу («разобраться с сайтом») разбей на 2–3 конкретных шага.
- priority: 1 — если сказано «срочно», «важно», «обязательно» или есть жёсткий дедлайн; 3 — «если успею», «когда-нибудь»; иначе 2.
- area: одно короткое слово, только если очевидно из контекста.
- Учитывай уже запланированные задачи: не ставь новую на занятое время. Если день выходит больше 8 часов, перенеси некритичное (priority 3) на следующий день и скажи об этом в summary.
- Не выдумывай задачи. Если в сообщении задач нет (приветствие, вопрос, /start), верни пустой tasks и коротко ответь в summary, что умеешь.
- summary пиши на «ты», по-русски, без смайликов: что добавил и на какие дни."""

USER = """=Сегодня: {{ $now.setZone('Europe/Moscow').setLocale('ru').toFormat('yyyy-MM-dd, cccc') }}.

Уже запланировано на 7 дней:
{{ JSON.stringify($('Задачи на неделю').item.json.tasks) }}

Сообщение пользователя:
{{ $('Текст').item.json.text }}"""

TG = "={{ $('Telegram Trigger').item.json.message.from.id }}"
CHAT = "={{ $('Telegram Trigger').item.json.message.chat.id }}"


def nid():
    return str(uuid.uuid4())


def node(name, type_, version, pos, params, **extra):
    return {"id": nid(), "name": name, "type": type_, "typeVersion": version, "position": pos, "parameters": params, **extra}


def if_params(left, op_type, operation, right=None):
    cond = {"id": nid(), "leftValue": left, "operator": {"type": op_type, "operation": operation}}
    if right is None:
        cond["rightValue"] = ""
        cond["operator"]["singleValue"] = True
    else:
        cond["rightValue"] = right
    return {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
            "conditions": [cond],
            "combinator": "and",
        },
        "options": {},
    }


api_auth = {
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": True,
    "headerParameters": {"parameters": [{"name": "x-telegram-user-id", "value": TG}]},
}

nodes = [
    node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, [0, 300],
         {"updates": ["message"], "additionalFields": {}}),
    node("Голосовое?", "n8n-nodes-base.if", 2.2, [220, 300],
         if_params("={{ $json.message.voice }}", "object", "exists")),
    node("Скачать голосовое", "n8n-nodes-base.telegram", 1.2, [440, 200],
         {"resource": "file", "fileId": "={{ $json.message.voice.file_id }}", "additionalFields": {}}),
    node("Расшифровать", "@n8n/n8n-nodes-langchain.openAi", 1.8, [660, 200],
         {"resource": "audio", "operation": "transcribe", "options": {"language": "ru"}}),
    node("Текст", "n8n-nodes-base.set", 3.4, [880, 300], {
        "assignments": {"assignments": [
            {"id": nid(), "name": "text", "type": "string",
             "value": "={{ $json.text ?? $('Telegram Trigger').item.json.message.text ?? '' }}"},
        ]},
        "options": {},
    }),
    node("Задачи на неделю", "n8n-nodes-base.httpRequest", 4.2, [1100, 300], {
        "url": f"{APP}/api/tasks",
        **api_auth,
        "sendQuery": True,
        "queryParameters": {"parameters": [
            {"name": "from", "value": "={{ $now.setZone('Europe/Moscow').toFormat('yyyy-MM-dd') }}"},
            {"name": "to", "value": "={{ $now.setZone('Europe/Moscow').plus({ days: 6 }).toFormat('yyyy-MM-dd') }}"},
        ]},
        "options": {},
    }),
    node("AI Agent", "@n8n/n8n-nodes-langchain.agent", 2, [1320, 300], {
        "promptType": "define",
        "text": USER,
        "hasOutputParser": True,
        "options": {"systemMessage": SYSTEM},
    }),
    node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.2, [1260, 520], {
        "model": {"__rl": True, "value": "gpt-4.1-mini", "mode": "list", "cachedResultName": "gpt-4.1-mini"},
        "options": {"temperature": 0.2},
    }),
    node("Structured Output Parser", "@n8n/n8n-nodes-langchain.outputParserStructured", 1.3, [1440, 520], {
        "schemaType": "manual",
        "inputSchema": json.dumps(SCHEMA, ensure_ascii=False, indent=2),
    }),
    node("Есть задачи?", "n8n-nodes-base.if", 2.2, [1640, 300],
         if_params("={{ $json.output.tasks.length }}", "number", "gt", 0)),
    node("Добавить в планер", "n8n-nodes-base.httpRequest", 4.2, [1860, 200], {
        "method": "POST",
        "url": f"{APP}/api/tasks",
        **api_auth,
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ source: 'voice', tasks: $json.output.tasks }) }}",
        "options": {},
    }),
    node("Ответить в Telegram", "n8n-nodes-base.telegram", 1.2, [2080, 300], {
        "chatId": CHAT,
        "text": "={{ $('AI Agent').item.json.output.summary }}",
        "additionalFields": {"appendAttribution": False},
    }),
]

for n in nodes:
    if n["name"] in ("Задачи на неделю", "Добавить в планер"):
        n["credentials"] = {"httpHeaderAuth": {"name": "Planner service key"}}

main = lambda *targets: {"main": [[{"node": t, "type": "main", "index": 0} for t in branch] for branch in targets]}
connections = {
    "Telegram Trigger": main(["Голосовое?"]),
    "Голосовое?": main(["Скачать голосовое"], ["Текст"]),
    "Скачать голосовое": main(["Расшифровать"]),
    "Расшифровать": main(["Текст"]),
    "Текст": main(["Задачи на неделю"]),
    "Задачи на неделю": main(["AI Agent"]),
    "AI Agent": main(["Есть задачи?"]),
    "Есть задачи?": main(["Добавить в планер"], ["Ответить в Telegram"]),
    "Добавить в планер": main(["Ответить в Telegram"]),
    "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
    "Structured Output Parser": {"ai_outputParser": [[{"node": "AI Agent", "type": "ai_outputParser", "index": 0}]]},
}

workflow = {
    "id": "voiceToPlanner01",
    "name": "Голос → Планер",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"},
    "pinData": {},
}

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(workflow, ensure_ascii=False, indent=2))
print("->", OUT)
