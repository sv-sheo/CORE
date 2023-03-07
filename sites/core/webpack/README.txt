HOW TO USE

from site root - i.e. /ss/sites/project

run this command:

	node webpack <action> <mode> <app>


action: possible values: run or watch
	
		run: 	create build once
		watch:	create build, start watching for changes AND boot up webpack-dev-server -> doesnt create file itself - serves it into memory for DEVELPMENT, to have final fila, use run

mode: possible values: dev or prod                  default dev
app: possible values: system, actilog, ...			default system

TL;DR

node webpack run            - DO NOT USE
node webpack run prod       - prod desktop

node webpack watch		    - USE FOR DEVELOPMENT

node webpack watch prod		- DO NOT USE

REGULAR

node webpack run prod counter
node webpack watch dev counter