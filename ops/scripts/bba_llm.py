"""Shared LLM cascade for BBA scripts.

Priority: Claude CLI (subscription) → Gemini → Groq → OpenAI
Import: from bba_llm import call_llm
"""
import os, json, subprocess, sys, urllib.request

CLAUDE_BIN  = '/home/openclaw/.nvm/versions/node/v22.22.1/bin/claude'
NODE_BIN    = '/home/openclaw/.nvm/versions/node/v22.22.1/bin'

def call_llm(prompt, max_tokens=800):
    # 1. Claude Code CLI (uses george's claude.ai subscription)
    if os.path.exists(CLAUDE_BIN):
        env = {**os.environ, 'PATH': f'{NODE_BIN}:{os.environ.get("PATH", "")}'}
        try:
            result = subprocess.run(
                [CLAUDE_BIN, '--print', prompt],
                capture_output=True, text=True, timeout=120, env=env,
            )
            text = result.stdout.strip()
            if result.returncode == 0 and text and 'Not logged in' not in text:
                return text
        except Exception as e:
            print(f'  Claude CLI failed: {e}', file=sys.stderr)

    # 2. Gemini
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    if gemini_key:
        body = json.dumps({
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'maxOutputTokens': max_tokens},
        }).encode()
        gurl = (f'https://generativelanguage.googleapis.com/v1beta/models/'
                f'gemini-2.0-flash:generateContent?key={gemini_key}')
        req = urllib.request.Request(gurl, data=body, headers={'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
            text = resp['candidates'][0]['content']['parts'][0]['text']
            if text:
                return text
        except Exception as e:
            print(f'  Gemini failed: {e}', file=sys.stderr)

    # 3. Groq
    groq_key = os.environ.get('GROQ_API_KEY', '')
    if groq_key:
        body = json.dumps({
            'model': 'llama-3.3-70b-versatile',
            'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}],
        }).encode()
        req = urllib.request.Request(
            'https://api.groq.com/openai/v1/chat/completions', data=body,
            headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
            text = resp['choices'][0]['message']['content']
            if text:
                return text
        except Exception as e:
            print(f'  Groq failed: {e}', file=sys.stderr)

    # 4. OpenAI
    openai_key = os.environ.get('OPENAI_API_KEY', '')
    if openai_key:
        body = json.dumps({
            'model': 'gpt-4o',
            'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}],
        }).encode()
        req = urllib.request.Request(
            'https://api.openai.com/v1/chat/completions', data=body,
            headers={'Authorization': f'Bearer {openai_key}', 'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
            text = resp['choices'][0]['message']['content']
            if text:
                return text
        except Exception as e:
            print(f'  OpenAI failed: {e}', file=sys.stderr)

    # 5. Anthropic (fallback — may be rate-limited)
    anthropic_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if anthropic_key:
        body = json.dumps({
            'model': 'claude-haiku-4-5-20251001',
            'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}],
        }).encode()
        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages', data=body,
            headers={
                'x-api-key': anthropic_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            })
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
            text = resp['content'][0]['text']
            if text:
                return text
        except Exception as e:
            print(f'  Anthropic failed: {e}', file=sys.stderr)

    return ''
