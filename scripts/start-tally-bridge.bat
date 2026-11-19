@echo off
cd /d "C:\ICON-TECH-PRO-ERP"
"C:\Program Files\nodejs\node.exe" scripts\tally-bridge-agent.mjs >> "C:\ICON-TECH-PRO-ERP\tally-bridge.log" 2>&1
