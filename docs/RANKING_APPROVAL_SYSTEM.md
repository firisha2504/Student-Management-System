# Ranking Approval System - Complete Guide

## Overview
The ranking approval system ensures that students can only see their rankings after the director has reviewed and approved them. This prevents premature disclosure of rankings before all grades are finalized.

## How It Works

### 1. Grade Calculation
- System automatically calculates student rankings based on their average scores
- Rankings are calculated per grade level and stream
- Only students with at least one grade are included in rankings

### 2. Director Approval Required
- By default, rankings are NOT visible to students
- Director must explicitly approve/publish rankings for each grade/stream group
- Students see a "Rankings Pending" message until approval

### 3. Student View
- Students can only see their own rank (not other students)
- Shows: rank position, total students, and average score
- Only visible after director approval

## Database Schema

### ranking_approvals Table
```sql
CREATE TABLE ranking_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grade_level INT NOT NULL,
  stream VARCHAR(50),
  term VARCHAR(20) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  approved_by INT NOT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (grade_level, stream, term, academic_year)
);
```

## Backend API Endpoints

### 1. Get Rankings
`GET /api/rankings/by-grade`

Query Parameters:
- `grade_level` (required): 9, 10, 11, or 12
- `stream` (optional): Science, Arts, Commerce
- `term` (optional): defaults to current term
- `academic_year` (optional): defaults to current year

Response for Students:
```json
{
  "approved": true,
  "myRank": {
    "user_id": 123,
    "full_name": "John Doe",
    "grade_level": 10,
    "stream": null,
    "average_score": 85.5,
    "rank": 5,
    "total_subjects": 8
  },
  "totalStudents": 45
}
```

Response for Director/Admin:
```json
{
  "approved": true,
  "rankings": [
    {
      "user_id": 456,
      "full_name": "Jane Smith",
      "grade_level": 10,
      "stream": null,
      "average_score": 92.3,
      "rank": 1,
      "total_subjects": 8
    },
    ...
  ]
}
```

### 2. Approve Rankings
`POST /api/rankings/approve` (Director only)

Body:
```json
{
  "grade_level": 10,
  "stream": "Science",
  "term": "Term 1",
  "academic_year": "2024-2025"
}
```

### 3. Unpublish Rankings
`DELETE /api/rankings/approve` (Director only)

Body: Same as approve

### 4. Check Approval Status
`GET /api/rankings/approval-status`

Query Parameters: Same as get rankings

## Frontend Components

### 1. StudentRanking Component
Location: `frontend/src/components/StudentRanking.tsx`

Features:
- Automatically checks if rankings are approved
- Shows "Rankings Pending" message if not approved
- Displays student's rank card when approved
- Shows rank position, total students, and average score

Usage:
```tsx
import StudentRanking from "@/components/StudentRanking";

// In student portal/home page
<StudentRanking />
```

### 2. RankingApproval Component
Location: `frontend/src/components/RankingApproval.tsx`

Features:
- Director can view rankings for any grade/stream
- Shows approval status (published/unpublished)
- One-click publish/unpublish button
- Full ranking table with all students

Usage:
```tsx
import RankingApproval from "@/components/RankingApproval";

// In director portal
<RankingApproval />
```

## Integration Steps

### For Director Portal
Add the RankingApproval component to the DirectorPortal page:

```tsx
import RankingApproval from "@/components/RankingApproval";

// In DirectorPortal.tsx
<RankingApproval />
```

### For Student Home Page
The StudentRanking component is already integrated in the Home page.

## Testing Instructions

### Step 1: Create Test Data
1. Ensure you have students in different grades
2. Add grades for students (at least one subject per student)
3. Login as director

### Step 2: Test Director View
1. Navigate to Director Portal
2. Select a grade level (and stream if Grade 11/12)
3. Click "View Rankings"
4. Verify rankings are calculated correctly
5. Notice "Unpublished" status

### Step 3: Test Student View (Before Approval)
1. Logout and login as a student
2. Go to Home page
3. Verify you see "Rankings Pending" message
4. Confirm rank is NOT visible

### Step 4: Publish Rankings
1. Logout and login as director
2. Go to Director Portal rankings
3. Click "Publish Rankings" button
4. Verify status changes to "Published"

### Step 5: Test Student View (After Approval)
1. Logout and login as student
2. Go to Home page
3. Verify you now see your rank card
4. Check rank position and average score are displayed

### Step 6: Unpublish Rankings
1. Login as director
2. Click "Unpublish Rankings"
3. Login as student again
4. Verify rank is hidden again

## Database Queries for Verification

### Check Approvals
```sql
SELECT * FROM ranking_approvals;
```

### View Rankings for Grade 10
```sql
SELECT 
  u.id,
  p.full_name,
  sp.grade_level,
  sp.stream,
  AVG(g.score) as average_score,
  COUNT(g.id) as total_subjects
FROM users u
INNER JOIN profiles p ON u.id = p.user_id
INNER JOIN student_profiles sp ON u.id = sp.user_id
INNER JOIN grades g ON u.id = g.student_id
WHERE sp.grade_level = 10
GROUP BY u.id
ORDER BY average_score DESC;
```

### Check if Rankings Approved for Grade 10
```sql
SELECT * FROM ranking_approvals 
WHERE grade_level = 10 
AND term = 'Term 1' 
AND academic_year = '2024-2025';
```

## Security Features

1. **Role-Based Access**
   - Only director can approve/unpublish rankings
   - Students can only see their own rank
   - Teachers/admin can view all rankings

2. **Approval Required**
   - Students cannot see rankings without director approval
   - Each grade/stream/term combination requires separate approval

3. **Audit Trail**
   - Tracks who approved rankings (approved_by)
   - Records approval timestamp (approved_at)

## Key Features

✅ Director must approve rankings before students can see them
✅ Students only see their own rank (not other students)
✅ Separate approval for each grade/stream/term
✅ One-click publish/unpublish functionality
✅ Clear status indicators (published/unpublished)
✅ Automatic ranking calculation based on average scores
✅ Handles grades with and without streams
✅ Shows "Rankings Pending" message when not approved

## Files Created/Modified

### New Files:
- `backend/add-ranking-approval-table.sql`
- `backend/add-ranking-approval.js`
- `backend/src/routes/rankings.js`
- `frontend/src/components/RankingApproval.tsx`

### Modified Files:
- `backend/src/server.js` (added rankings routes)
- `frontend/src/services/api.ts` (added ranking API methods)
- `frontend/src/components/StudentRanking.tsx` (updated to use new API)

## Next Steps (Optional Enhancements)

1. **Email Notifications** - Notify students when rankings are published
2. **Bulk Approval** - Approve all grades at once
3. **Ranking History** - Track ranking changes over time
4. **Top Performers** - Highlight top 3 students
5. **Ranking Analytics** - Show ranking trends and statistics
6. **Auto-Publish** - Schedule automatic publishing on specific dates

## Troubleshooting

### Students can't see rankings
- Check if director has approved rankings for that grade/stream
- Verify student has grades entered
- Check database: `SELECT * FROM ranking_approvals`

### Rankings not calculating
- Ensure students have grades in the grades table
- Check term and academic_year match current settings
- Verify student_profiles table has correct grade_level

### Director can't publish
- Verify user has director role
- Check authentication token is valid
- Look for errors in browser console

## System Ready! 🎉

The ranking approval system is fully functional. Directors now have complete control over when students can see their rankings, ensuring grades are finalized before disclosure.
