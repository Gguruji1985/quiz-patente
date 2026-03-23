@echo off
set EXE_PATH=QuizPatente.exe

if exist "%EXE_PATH%" (
    echo Avvio di Quiz Patente...
    echo.
    "%EXE_PATH%"
) else (
    echo Errore: %EXE_PATH% non trovato.
    echo Prova a eseguire 'npm run build:exe' per generarlo.
    pause
)
