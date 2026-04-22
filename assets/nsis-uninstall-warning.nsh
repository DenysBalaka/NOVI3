!macro customUnInit
  StrCpy $0 "$APPDATA\TeacherJournal"
  StrCpy $1 "$0\google_token.json"

  IfFileExists "$1" 0 +3
    MessageBox MB_ICONEXCLAMATION|MB_YESNO "Увага! Ви видаляєте TeacherJournal.$\r$\n$\r$\nОскільки ви (ймовірно) увійшли в акаунт Google, перед закриттям програма може зберегти/синхронізувати дані в Google Drive (якщо під час роботи виконувалась синхронізація).$\r$\n$\r$\nЛокальні файли даних на цьому ПК зберігаються тут:$\r$\n$0$\r$\n$\r$\nПродовжити видалення?" IDYES +2
      Abort
    Goto done

  MessageBox MB_ICONEXCLAMATION|MB_YESNO "Увага! Ви видаляєте TeacherJournal.$\r$\n$\r$\nЛокальні файли даних на цьому ПК зберігаються тут:$\r$\n$0$\r$\n$\r$\nПродовжити видалення?" IDYES +2
    Abort

done:
!macroend

