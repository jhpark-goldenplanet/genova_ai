"""
Preset -> Prompt mapping for AI analysis.
Maps 4-dimensional preset settings to prompt instructions.
"""

from typing import Optional


DENSITY_PROMPT = {
    "brief": "Write the summary for each segment in 1-2 sentences, keeping it very concise.",
    "standard": "Write the summary for each segment in 3-5 sentences.",
    "detailed": "Write a detailed paragraph-level summary for each segment. Include context, reasoning, and supporting details.",
}

FOCUS_PROMPT = {
    "key_points": "Focus on key content and main conclusions.",
    "action_items": "Focus on action items, decisions, and responsible parties.",
    "learning": "Focus on learning objectives, core concepts, and key takeaways.",
    "qa": "Summarize in a question-and-answer format for each segment.",
}

SCRIPT_PROMPT = {
    "verbatim": "For transcript, transcribe the spoken audio exactly as-is, including filler words.",
    "polished": "For transcript, transcribe the spoken audio but remove filler words and polish sentences for readability.",
    "condensed": "For transcript, summarize only the key statements concisely. Suitable for subtitles.",
}

TONE_PROMPT = {
    "concise": "Use a concise, direct writing style.",
    "formal": "Use a formal style suitable for reports and documentation.",
    "easy": "Use an easy, accessible style that anyone can understand.",
}

# Korean versions for ko language
DENSITY_PROMPT_KO = {
    "brief": "각 구간의 summary를 1-2문장으로 간략히 작성해주세요.",
    "standard": "각 구간의 summary를 3-5문장으로 작성해주세요.",
    "detailed": "각 구간의 summary를 문단 단위로 상세히 작성해주세요. 맥락과 근거를 포함합니다.",
}

FOCUS_PROMPT_KO = {
    "key_points": "핵심 내용과 주요 결론을 중심으로 요약해주세요.",
    "action_items": "실행해야 할 항목, 결정 사항, 담당자를 중심으로 요약해주세요.",
    "learning": "학습 목표, 핵심 개념, 이해해야 할 포인트를 중심으로 요약해주세요.",
    "qa": "주요 질문과 답변 형태로 요약해주세요.",
}

SCRIPT_PROMPT_KO = {
    "verbatim": "transcript는 음성을 있는 그대로 전사해주세요. 간투사(어..., 음...)도 포함합니다.",
    "polished": "transcript는 음성을 전사하되, 불필요한 간투사를 제거하고 문장을 자연스럽게 다듬어주세요.",
    "condensed": "transcript는 핵심 발화만 요약하여 간결하게 전사해주세요. 자막용으로 적합하게 작성합니다.",
}

TONE_PROMPT_KO = {
    "concise": "간결한 문체로 작성해주세요.",
    "formal": "보고서에 적합한 격식체로 작성해주세요.",
    "easy": "누구나 이해할 수 있는 쉬운 설명체로 작성해주세요.",
}


def build_preset_prompt(preset: Optional[dict], language: str = "ko") -> str:
    """
    Build prompt instructions from preset settings.

    Args:
        preset: Dict with keys: summaryDensity, analysisFocus, scriptStyle, tone
        language: Source language for prompt localization

    Returns:
        Prompt instruction string (empty if no preset)
    """
    if not preset:
        return ""

    is_ko = language == "ko"
    parts = []

    density = preset.get("summaryDensity")
    if density:
        mapping = DENSITY_PROMPT_KO if is_ko else DENSITY_PROMPT
        if density in mapping:
            parts.append(mapping[density])

    focus = preset.get("analysisFocus")
    if focus:
        mapping = FOCUS_PROMPT_KO if is_ko else FOCUS_PROMPT
        if focus in mapping:
            parts.append(mapping[focus])

    script = preset.get("scriptStyle")
    if script:
        mapping = SCRIPT_PROMPT_KO if is_ko else SCRIPT_PROMPT
        if script in mapping:
            parts.append(mapping[script])

    tone = preset.get("tone")
    if tone:
        mapping = TONE_PROMPT_KO if is_ko else TONE_PROMPT
        if tone in mapping:
            parts.append(mapping[tone])

    return "\n".join(parts)
