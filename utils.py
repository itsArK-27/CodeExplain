"""
utils.py — Helper utilities for CodeExplain
"""

import re


LANGUAGE_EXTENSIONS = {
    "Python": ["def ", "import ", "print(", "elif ", "lambda ", "self.", ":#", "    "],
    "JavaScript": ["function ", "const ", "let ", "var ", "=>", "console.log", "require(", "module.exports"],
    "TypeScript": ["interface ", ": string", ": number", ": boolean", "type ", "enum ", "readonly "],
    "Java": ["public class", "public static", "System.out", "import java", "void ", "String[] args"],
    "C++": ["#include", "std::", "cout", "cin", "int main(", "namespace ", "template<", "->"],
    "C": ["#include", "printf(", "scanf(", "int main(", "malloc(", "free(", "struct "],
    "Go": ["package main", "func ", "fmt.Println", "import (", ":=", "goroutine", "chan "],
    "Rust": ["fn main()", "let mut", "println!", "use std", "impl ", "pub fn", "match "],
    "Ruby": ["def ", "puts ", "end\n", "attr_", "require '", "class ", ".each", "do |"],
    "PHP": ["<?php", "echo ", "$", "->", "public function", "namespace ", "use \\"],
    "Swift": ["func ", "var ", "let ", "print(", "import Foundation", "class ", "struct ", "guard "],
    "Kotlin": ["fun ", "val ", "var ", "println(", "import ", "class ", "object ", "companion object"],
    "R": ["<-", "library(", "data.frame(", "ggplot(", "function(", "c(", "print(", "for ("],
    "SQL": ["SELECT", "FROM", "WHERE", "JOIN", "INSERT", "UPDATE", "DELETE", "CREATE TABLE"],
    "Bash": ["#!/bin/bash", "echo ", "if [", "fi\n", "for ", "do\n", "done\n", "$1"],
}

SUPPORTED_LANGUAGES = [
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C",
    "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "R", "SQL", "Bash", "Other"
]


def detect_language(code: str) -> str:
    """Auto-detect programming language from code snippet."""
    if not code.strip():
        return "Python"
    
    scores = {lang: 0 for lang in LANGUAGE_EXTENSIONS}
    code_upper = code.upper()
    
    for lang, patterns in LANGUAGE_EXTENSIONS.items():
        for pattern in patterns:
            if pattern.upper() in code_upper:
                scores[lang] += 1
    
    # SQL special: all caps keywords
    if any(kw in code_upper for kw in ["SELECT ", "FROM ", "WHERE "]):
        scores["SQL"] += 3
    
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Python"


def format_code_with_numbers(code: str) -> str:
    """Add line numbers to code."""
    lines = code.split('\n')
    return '\n'.join(f"{i+1:3} | {line}" for i, line in enumerate(lines))


def truncate_code(code: str, max_lines: int = 150) -> tuple[str, bool]:
    """Truncate code if too long, return (code, was_truncated)."""
    lines = code.split('\n')
    if len(lines) > max_lines:
        return '\n'.join(lines[:max_lines]), True
    return code, False


def validate_code_input(code: str) -> tuple[bool, str]:
    """Validate code input. Returns (is_valid, error_message)."""
    if not code or not code.strip():
        return False, "Please paste some code to analyze."
    if len(code.strip()) < 10:
        return False, "Code snippet is too short. Please paste at least a few lines."
    if len(code) > 50000:
        return False, "Code is too long (max 50,000 characters). Please use a shorter snippet."
    return True, ""


def get_language_icon(language: str) -> str:
    """Return emoji icon for a language."""
    icons = {
        "Python": "🐍", "JavaScript": "🟨", "TypeScript": "🔷",
        "Java": "☕", "C++": "⚙️", "C": "🔧", "Go": "🐹",
        "Rust": "🦀", "Ruby": "💎", "PHP": "🐘", "Swift": "🦅",
        "Kotlin": "🎯", "R": "📊", "SQL": "🗃️", "Bash": "💻",
        "Other": "📄",
    }
    return icons.get(language, "📄")


def complexity_color(complexity: str) -> str:
    """Return CSS color class for complexity notation."""
    c = complexity.upper()
    if "O(1)" in c:
        return "complexity-green"
    elif "O(LOG" in c or "O(N LOG" in c:
        return "complexity-blue"
    elif "O(N)" in c:
        return "complexity-yellow"
    elif "O(N^2)" in c or "O(N²)" in c or "O(N*N)" in c:
        return "complexity-orange"
    elif "O(2^N)" in c or "O(N!)" in c:
        return "complexity-red"
    else:
        return "complexity-gray"


def get_sample_snippets() -> dict[str, str]:
    """Return sample code snippets for quick testing."""
    return {
        "Python — Binary Search": '''def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1''',

        "JavaScript — Fibonacci": '''function fibonacci(n) {
    const memo = {};
    function fib(n) {
        if (n <= 1) return n;
        if (memo[n]) return memo[n];
        memo[n] = fib(n - 1) + fib(n - 2);
        return memo[n];
    }
    return fib(n);
}''',

        "Python — Bubble Sort": '''def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr''',

        "Java — Stack Implementation": '''import java.util.ArrayList;

public class Stack<T> {
    private ArrayList<T> data = new ArrayList<>();
    
    public void push(T item) {
        data.add(item);
    }
    
    public T pop() {
        if (isEmpty()) throw new RuntimeException("Stack is empty");
        return data.remove(data.size() - 1);
    }
    
    public T peek() {
        if (isEmpty()) throw new RuntimeException("Stack is empty");
        return data.get(data.size() - 1);
    }
    
    public boolean isEmpty() {
        return data.isEmpty();
    }
}''',
    }
