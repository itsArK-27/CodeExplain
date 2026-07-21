"""Quick debug script to test the full github analyze SSE flow locally."""
import os
import json
from dotenv import load_dotenv
load_dotenv()

from server import clone_and_parse_github_repo
from llm_engine import generate_github_analysis_stream

url = "https://github.com/itsArK-27/CodeExplain"

print("=== Step 1: Clone and parse ===")
try:
    ctx = clone_and_parse_github_repo(url)
    print(f"Context length: {len(ctx)} chars")
    print(f"First 200 chars: {repr(ctx[:200])}")
except Exception as e:
    print(f"CLONE ERROR: {e}")
    exit(1)

print("\n=== Step 2: Build SSE context event ===")
context_event = f"data: {json.dumps({'type': 'context', 'repo_context': ctx})}\n\n"
print(f"Context event length: {len(context_event)}")
print(f"Starts with 'data: ': {context_event.startswith('data: ')}")
print(f"Ends with two newlines: {context_event.endswith(chr(10)+chr(10))}")

print("\n=== Step 3: Test LLM stream ===")
try:
    stream = generate_github_analysis_stream(ctx, "English")
    count = 0
    for chunk in stream:
        count += 1
        if count <= 3:
            print(f"Chunk {count}: {chunk}")
        if count > 3:
            print(f"...total chunks: continuing...")
    print(f"Total chunks received: {count}")
    print(f"Last chunk: {chunk}")
except Exception as e:
    print(f"LLM ERROR: {e}")
