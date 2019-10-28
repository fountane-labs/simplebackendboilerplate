PROCESS_NAME=appname
LOGS_HOME=/root/logs

run:
	npm start

install:
	sudo apt-get install libssh2-1-dev libcurl4-openssl-dev libssl-dev openssl
	npm install
	mkdir -p public/files
	cd public
	bower install

push:
	git add --all
	git commit
	git push -u origin master

pull:
	git pull -v origin master

update:
	make pull
	make restart

pm2-start:
	pm2 start --name $(PROCESS_NAME) bin/www -o $(LOGS_HOME)/$(PROCESS_NAME)/out.log -e $(LOGS_HOME)/$(PROCESS_NAME)/err.log -l $(LOGS_HOME)/$(PROCESS_NAME)/complete.log

stop:
	pm2 stop $(PROCESS_NAME)
restart:
	pm2 restart $(PROCESS_NAME)

delete:
	pm2 delete $(PROCESS_NAME)

logs:
	pm2 logs $(PROCESS_NAME)

log-dir:
	mkdir $(LOGS_HOME)/$(PROCESS_NAME)


db:
	node utilities/createdb.js

login_server:
	psql -h localhost -d fountane fountane
