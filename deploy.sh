#!/bin/sh
# Atajo para subir cambios: limpia candados, prepara todo, commitea y hace push.
# Uso:  sh deploy.sh            -> mensaje automatico con fecha/hora
#       sh deploy.sh "mi texto" -> mensaje personalizado
rm -f .git/*.lock 2>/dev/null
git add -A
git commit -m "${1:-update $(date '+%Y-%m-%d %H:%M')}"
git push
