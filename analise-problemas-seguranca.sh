#!/bin/bash

echo "🔍 Analisando problemas de segurança no frontend..."
echo ""

# 1. User IDs em keys do React
echo "1️⃣ User IDs em keys do React:"
grep -r "key={.*user.*id\|key={.*userId\|key={.*user_id" src --include="*.tsx" --include="*.ts" -i | wc -l
echo "   Exemplos encontrados:"
grep -r "key={.*user.*id\|key={.*userId\|key={.*user_id" src --include="*.tsx" --include="*.ts" -i | head -5

echo ""
echo "2️⃣ Console.logs diretos:"
grep -r "console\.\(log\|error\|warn\|debug\)" src --include="*.tsx" --include="*.ts" | grep -v "console\.log = \|console\.error = \|console\.warn = \|console\.debug = " | wc -l
echo "   Exemplos encontrados:"
grep -r "console\.\(log\|error\|warn\|debug\)" src --include="*.tsx" --include="*.ts" | grep -v "console\.log = \|console\.error = \|console\.warn = \|console\.debug = " | head -5

echo ""
echo "3️⃣ JSON.stringify de dados sensíveis:"
grep -r "JSON\.stringify" src --include="*.tsx" --include="*.ts" | wc -l
echo "   Exemplos encontrados:"
grep -r "JSON\.stringify" src --include="*.tsx" --include="*.ts" | head -5

echo ""
echo "4️⃣ Dados sensíveis em localStorage:"
grep -r "localStorage\.\(setItem\|getItem\)" src --include="*.tsx" --include="*.ts" | wc -l
echo "   Exemplos encontrados:"
grep -r "localStorage\.\(setItem\|getItem\)" src --include="*.tsx" --include="*.ts" | head -5

echo ""
echo "5️⃣ User IDs expostos (não em keys):"
grep -r "user\.id\|userId\|user_id" src --include="*.tsx" --include="*.ts" | grep -v "key=" | grep -v "//" | wc -l

echo ""
echo "6️⃣ IDs em URL params:"
grep -r "useParams\|useSearchParams\|URLSearchParams" src --include="*.tsx" --include="*.ts" | wc -l
echo "   Exemplos encontrados:"
grep -r "useParams\|useSearchParams\|URLSearchParams" src --include="*.tsx" --include="*.ts" | head -5

