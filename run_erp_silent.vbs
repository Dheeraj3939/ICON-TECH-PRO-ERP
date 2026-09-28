Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\ICON-TECH-PRO-ERP"
WshShell.Run "cmd.exe /c npx next start -H 0.0.0.0 -p 3000", 0, False
