import re

file_path = 'frontend/src/app/(workspace)/dashboard/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (r'bg-\[\#080a10\]', r'bg-slate-50 dark:bg-[#080a10]'),
    (r'\bbg-white/4\b', r'bg-white dark:bg-white/4'),
    (r'\bborder-white/8\b', r'border-slate-200 dark:border-white/8'),
    (r'\bborder-white/6\b', r'border-slate-200 dark:border-white/6'),
    (r'\bborder-white/5\b', r'border-slate-200 dark:border-white/5'),
    (r'\bborder-white/10\b', r'border-slate-200 dark:border-white/10'),
    (r'\btext-white/40\b', r'text-slate-500 dark:text-white/40'),
    (r'\btext-white/35\b', r'text-slate-500 dark:text-white/35'),
    (r'\btext-white/30\b', r'text-slate-500 dark:text-white/30'),
    (r'\btext-white/25\b', r'text-slate-400 dark:text-white/25'),
    (r'\btext-white/20\b', r'text-slate-400 dark:text-white/20'),
    (r'\btext-white/50\b', r'text-slate-500 dark:text-white/50'),
    (r'\btext-white/60\b', r'text-slate-600 dark:text-white/60'),
    (r'\btext-white/70\b', r'text-slate-600 dark:text-white/70'),
    (r'\btext-white/80\b', r'text-slate-700 dark:text-white/80'),
    (r'(?<![-/])\btext-white\b(?!/[0-9])', r'text-slate-900 dark:text-white'),
    (r'\btext-indigo-400\b', r'text-indigo-600 dark:text-indigo-400'),
    (r'\btext-emerald-400\b', r'text-emerald-600 dark:text-emerald-400'),
    (r'\btext-amber-400\b', r'text-amber-600 dark:text-amber-400'),
    (r'\btext-violet-400\b', r'text-violet-600 dark:text-violet-400'),
    (r'\btext-red-400\b', r'text-red-600 dark:text-red-400'),
    (r'\bbg-indigo-500/15\b', r'bg-indigo-100 dark:bg-indigo-500/15'),
    (r'\bbg-violet-500/15\b', r'bg-violet-100 dark:bg-violet-500/15'),
    (r'\bbg-amber-500/15\b', r'bg-amber-100 dark:bg-amber-500/15'),
    (r'\bbg-emerald-500/15\b', r'bg-emerald-100 dark:bg-emerald-500/15'),
    (r'\bbg-emerald-500/60\b', r'bg-emerald-500/20 dark:bg-emerald-500/60'),
    (r'\bbg-white/5\b', r'bg-slate-100 dark:bg-white/5'),
    (r'\bbg-white/10\b', r'bg-slate-200 dark:bg-white/10'),
    (r'\bbg-white/20\b', r'bg-slate-300 dark:bg-white/20'),
    (r'\bbg-white/8\b', r'bg-slate-200 dark:bg-white/8'),
    (r'\bhover:bg-white/\[0\.06\]\b', r'hover:bg-slate-50 dark:hover:bg-white/[0.06]'),
    (r'\bhover:bg-white/\[0\.025\]\b', r'hover:bg-slate-50 dark:hover:bg-white/[0.025]'),
    (r'\bhover:border-white/15\b', r'hover:border-slate-300 dark:hover:border-white/15'),
]

for pattern, repl in replacements:
    content = re.sub(pattern, repl, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated dashboard page.tsx')
