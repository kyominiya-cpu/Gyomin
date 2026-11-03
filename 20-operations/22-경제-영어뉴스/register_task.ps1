# 매일 07:07에 daily_news.py를 실행하는 작업 스케줄러 등록 (PC가 꺼져 있었으면 켜진 뒤 바로 실행)
# 해제: Unregister-ScheduledTask -TaskName "경제영어뉴스-매일" -Confirm:$false
$dir = $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "C:\Users\kyomi\AppData\Local\Programs\Python\Python312\python.exe" `
    -Argument "-X utf8 `"$dir\daily_news.py`"" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -Daily -At 7:07am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "경제영어뉴스-매일" -Action $action -Trigger $trigger -Settings $settings `
    -Description "매일 경제 영어뉴스 3개를 노션에 올림" -Force | Select-Object TaskName, State
"다음 실행: " + (Get-ScheduledTaskInfo -TaskName "경제영어뉴스-매일").NextRunTime
