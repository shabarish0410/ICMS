import pandas as pd
import io
import logging
from datetime import datetime
from fastapi.responses import StreamingResponse

from app.core.supabase import get_supabase
from app.core.exceptions import BusinessLogicError

logger = logging.getLogger("icms.exports")


def export_students(current_user: dict) -> StreamingResponse:
    try:
        supabase = get_supabase()
        res = supabase.table("students").select("*, user:users(*)").execute()
        
        data = []
        for s in res.data:
            user = s.get("user") or {}
            data.append({
                "ID": s.get("id"),
                "Name": user.get("full_name", ""),
                "IC Number": user.get("ic_number", ""),
                "Email": user.get("email", ""),
                "Mobile": user.get("mobile", ""),
                "Course": s.get("course", ""),
                "Year": s.get("year", ""),
                "Active Status": "Active" if user.get("is_active") else "Inactive",
                "Registration Date": user.get("created_at", "")[:10] if user.get("created_at") else ""
            })
            
        df = pd.DataFrame(data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Students')
            
        output.seek(0)
        
        filename = f"Students_Export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            output, 
            headers=headers, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"Failed to export students: {str(e)}")
        raise BusinessLogicError("Failed to generate export file.", status_code=500)


def export_attendance(event_id: int, current_user: dict) -> StreamingResponse:
    try:
        supabase = get_supabase()
        
        query = supabase.table("attendance").select("*, student:students(user:users(*)), event:events(*)")
        if event_id:
            query = query.eq("event_id", event_id)
            
        res = query.execute()
        
        data = []
        for a in res.data:
            student = a.get("student") or {}
            user = student.get("user") or {}
            event = a.get("event") or {}
            
            data.append({
                "Attendance ID": a.get("id"),
                "Date & Time": a.get("timestamp", ""),
                "Student Name": user.get("full_name", ""),
                "IC Number": user.get("ic_number", ""),
                "Event": event.get("title", ""),
                "Method": a.get("method", ""),
                "Status": a.get("status", ""),
                "Notes": a.get("notes", "")
            })
            
        df = pd.DataFrame(data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Attendance')
            
        output.seek(0)
        
        filename = f"Attendance_Export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            output, 
            headers=headers, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"Failed to export attendance: {str(e)}")
        raise BusinessLogicError("Failed to generate export file.", status_code=500)


def export_form_responses(form_id: int, format: str, current_user: dict) -> StreamingResponse:
    try:
        supabase = get_supabase()
        
        form_res = supabase.table("forms").select("*, questions:form_questions(*)").eq("id", form_id).execute()
        if not form_res.data:
            raise BusinessLogicError("Form not found", status_code=404)
            
        questions = form_res.data[0].get("questions", [])
        questions.sort(key=lambda q: q.get("order_no", 0))
        
        query = supabase.table("form_responses").select("*, student:students(*, user:users(*)), answers:response_answers(*)").eq("form_id", form_id).order("submitted_at", desc=True)
        res = query.execute()
        
        data = []
        for r in res.data:
            student = r.get("student") or {}
            user = student.get("user") or {}
            answers = {a.get("question_id"): (a.get("answer") or a.get("file_path")) for a in r.get("answers", [])}
            
            row = {
                "Response ID": r.get("id"),
                "Student Name": user.get("full_name", "Anonymous"),
                "IC Number": user.get("ic_number", "-"),
                "Submitted On": r.get("submitted_at", "")[:19].replace("T", " ") if r.get("submitted_at") else "",
                "Status": r.get("status", "")
            }
            
            for q in questions:
                row[q.get("question")] = answers.get(q.get("id"), "")
                
            data.append(row)
            
        df = pd.DataFrame(data)
        output = io.BytesIO()
        
        if format.lower() == 'excel':
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Responses')
            media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ext = 'xlsx'
        else:
            df.to_csv(output, index=False)
            media_type = 'text/csv'
            ext = 'csv'
            
        output.seek(0)
        filename = f"Form_{form_id}_Responses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            output, 
            headers=headers, 
            media_type=media_type
        )
        
    except Exception as e:
        logger.error(f"Failed to export form responses: {str(e)}")
        raise BusinessLogicError("Failed to generate export file.", status_code=500)
