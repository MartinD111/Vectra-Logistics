const fs = require('fs');

const filePath = 'frontend/src/app/(workspace)/dashboard/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    [/bg-\[\#080a10\]/g, 'bg-slate-50 dark:bg-[#080a10]'],
    [/\bbg-white\/4\b/g, 'bg-white dark:bg-white/4'],
    [/\bborder-white\/8\b/g, 'border-slate-200 dark:border-white/8'],
    [/\bborder-white\/6\b/g, 'border-slate-200 dark:border-white/6'],
    [/\bborder-white\/5\b/g, 'border-slate-200 dark:border-white/5'],
    [/\bborder-white\/10\b/g, 'border-slate-200 dark:border-white/10'],
    [/\btext-white\/40\b/g, 'text-slate-500 dark:text-white/40'],
    [/\btext-white\/35\b/g, 'text-slate-500 dark:text-white/35'],
    [/\btext-white\/30\b/g, 'text-slate-500 dark:text-white/30'],
    [/\btext-white\/25\b/g, 'text-slate-400 dark:text-white/25'],
    [/\btext-white\/20\b/g, 'text-slate-400 dark:text-white/20'],
    [/\btext-white\/50\b/g, 'text-slate-500 dark:text-white/50'],
    [/\btext-white\/60\b/g, 'text-slate-600 dark:text-white/60'],
    [/\btext-white\/70\b/g, 'text-slate-600 dark:text-white/70'],
    [/\btext-white\/80\b/g, 'text-slate-700 dark:text-white/80'],
    [/(?<![-/])\btext-white\b(?!\/[0-9])/g, 'text-slate-900 dark:text-white'],
    [/\btext-indigo-400\b/g, 'text-indigo-600 dark:text-indigo-400'],
    [/\btext-emerald-400\b/g, 'text-emerald-600 dark:text-emerald-400'],
    [/\btext-amber-400\b/g, 'text-amber-600 dark:text-amber-400'],
    [/\btext-violet-400\b/g, 'text-violet-600 dark:text-violet-400'],
    [/\btext-red-400\b/g, 'text-red-600 dark:text-red-400'],
    [/\bbg-indigo-500\/15\b/g, 'bg-indigo-100 dark:bg-indigo-500/15'],
    [/\bbg-violet-500\/15\b/g, 'bg-violet-100 dark:bg-violet-500/15'],
    [/\bbg-amber-500\/15\b/g, 'bg-amber-100 dark:bg-amber-500/15'],
    [/\bbg-emerald-500\/15\b/g, 'bg-emerald-100 dark:bg-emerald-500/15'],
    [/\bbg-emerald-500\/60\b/g, 'bg-emerald-500/20 dark:bg-emerald-500/60'],
    [/\bbg-white\/5\b/g, 'bg-slate-100 dark:bg-white/5'],
    [/\bbg-white\/10\b/g, 'bg-slate-200 dark:bg-white/10'],
    [/\bbg-white\/20\b/g, 'bg-slate-300 dark:bg-white/20'],
    [/\bbg-white\/8\b/g, 'bg-slate-200 dark:bg-white/8'],
    [/\bhover:bg-white\/\[0\.06\]\b/g, 'hover:bg-slate-50 dark:hover:bg-white/[0.06]'],
    [/\bhover:bg-white\/\[0\.025\]\b/g, 'hover:bg-slate-50 dark:hover:bg-white/[0.025]'],
    [/\bhover:border-white\/15\b/g, 'hover:border-slate-300 dark:hover:border-white/15'],
];

for (const [pattern, repl] of replacements) {
    content = content.replace(pattern, repl);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated dashboard page.tsx');
