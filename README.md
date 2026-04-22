# מגדל 1 — מדריך התקנה מלא

## מה יש פה?
אפליקציית ווב מלאה לניהול ועד הבית של מגדל 1 תל אביב.
- Next.js 14 (React) — הפרונטאנד
- Supabase — בסיס נתונים + אימות משתמשים + הרשאות
- Vercel — אחסון חינמי + פריסה אוטומטית

---

## שלב 1 — Supabase (בסיס הנתונים)

1. פתח חשבון חינמי ב: https://supabase.com
2. צור פרויקט חדש → שם: `mgdal1` → בחר אזור: `eu-central-1` (פרנקפורט)
3. המתן עד שהפרויקט מוכן (כ-2 דקות)
4. לך ל: **SQL Editor** (בסרגל השמאלי)
5. לחץ "New query"
6. העתק את כל התוכן מהקובץ `supabase/schema.sql`
7. הדבק ולחץ **Run** — זה יוצר את כל הטבלאות, ההרשאות, והנתונים הראשוניים
8. לך ל: **Settings → API**
9. שמור לעצמך:
   - `Project URL` (נראה כך: `https://xxxx.supabase.co`)
   - `anon public` key (מפתח ארוך)

---

## שלב 2 — הפרויקט המקומי

```bash
# התקן Node.js אם אין: https://nodejs.org (גרסה 18+)

# הורד את הפרויקט
# (אם העתקת את הקבצים ידנית — דלג על השלב הזה)
cd mgdal1

# התקן תלויות
npm install

# צור קובץ סביבה
cp .env.example .env.local
```

פתח `.env.local` וערוך:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

```bash
# הרץ לפיתוח
npm run dev
```

פתח דפדפן: http://localhost:3000

---

## שלב 3 — צור משתמש ראשון (מנהל)

1. ב-Supabase: לך ל **Authentication → Users**
2. לחץ "Add user" → הזן אימייל וסיסמה
3. לאחר יצירה, לך ל **Table Editor → profiles**
4. מצא את המשתמש שיצרת
5. שנה את `role` ל-`admin`
6. שמור

עכשיו תוכל להתחבר לאפליקציה עם האימייל והסיסמה שהגדרת.

---

## שלב 4 — פריסה ב-Vercel (אחסון אמיתי)

```bash
# התקן Vercel CLI
npm install -g vercel

# התחבר
vercel login

# פרוס
vercel
```

**או דרך ממשק הוויב:**
1. העלה את הפרויקט ל-GitHub (חשבון חינמי)
2. לך ל: https://vercel.com → "Add New Project"
3. חבר את ה-GitHub repo
4. הוסף Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. לחץ Deploy

בתוך דקה תקבל כתובת URL אמיתית (לדוגמה: `mgdal1.vercel.app`)

---

## שלב 5 — הוספת משתמשים לדיירים

לכל דייר/נציג ועד:
1. Supabase → Authentication → "Invite user" (שולח אימייל אוטומטי)
2. לאחר שהמשתמש אישר → Table Editor → profiles → שנה `role` ו-`apartment_id`

### תפקידים:
| תפקיד | מה רואה |
|--------|---------|
| `admin` | הכל |
| `committee` | גבייה + ספקים + תקלות |
| `manager` | ספקים + תקלות (ללא כספים) |
| `resident` | דירה שלו + תשלומים + תקלות |
| `readonly` | לוח בקרה + תקציב |

---

## שאלות נפוצות

**שאלה: האפליקציה עולה אבל לא מתחברת?**
→ בדוק שה-URL וה-KEY ב-.env.local נכונים ואין רווחים מיותרים

**שאלה: הטבלאות לא נוצרו?**
→ הרץ שוב את ה-SQL, ודא שאין שגיאות אדומות ב-SQL Editor

**שאלה: איך מוסיפים תשלומי WhatsApp/SMS?**
→ פתח Twilio חשבון חינמי, הוסף את המפתחות ל-.env.local
   ואני אוסיף את הקוד לשליחת הודעות

**שאלה: כמה עולה?**
→ Supabase חינמי עד 500MB + 50,000 משתמשים
→ Vercel חינמי עד 100GB bandwidth
→ לפרויקט כזה — 0 ₪ לחלוטין
