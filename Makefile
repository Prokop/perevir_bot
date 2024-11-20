THIS_FILE := $(lastword $(MAKEFILE_LIST))
.PHONY: help build up start down stop restart logs ps db-shell push_image_stage push_image_prod deploy_prod deploy_stage
help:
	make -pRrq  -f $(THIS_FILE) : 2>/dev/null | awk -v RS= -F: '/^# File/,/^# Finished Make data base/ {if ($$1 !~ "^[#.]") {print $$1}}' | sort | egrep -v -e '^[^[:alnum:]]' -e '^$@$$'
build:
	docker compose -f docker-compose.yml build $(c)
up:
	docker compose -f docker-compose.yml up -d $(c)
start:
	docker compose -f docker-compose.yml start $(c)
down:
	docker compose -f docker-compose.yml down $(c)
stop:
	docker compose -f docker-compose.yml stop $(c)
restart:
	docker compose -f docker-compose.yml stop bot
	docker compose -f docker-compose.yml up -d bot
logs:
	docker compose -f docker-compose.yml logs --tail=500 -f bot
ps:
	docker compose -f docker-compose.yml ps
db-shell:
	docker compose -f docker-compose.yml exec mongo mongo
push_image_prod:
	@echo "Building new PROD image..."
	aws ecr get-login-password | docker login --username AWS --password-stdin 547600246465.dkr.ecr.eu-central-1.amazonaws.com/perevir_bot
	docker build -t perevir_bot .
	docker tag perevir_bot:latest 547600246465.dkr.ecr.eu-central-1.amazonaws.com/perevir_bot:latest
	@echo "Pushing new PROD image to ECR..."
	docker push 547600246465.dkr.ecr.eu-central-1.amazonaws.com/perevir_bot:latest
push_image_stage:
	@echo "Building new STAGING image..."
	aws ecr get-login-password | docker login --username AWS --password-stdin 547600246465.dkr.ecr.eu-central-1.amazonaws.com/perevir_bot
	docker build -t perevir_bot .
	docker tag perevir_bot:latest 547600246465.dkr.ecr.eu-central-1.amazonaws.com/perevir_bot:staging
	@echo "Pushing new PROD image to ECR..."
	docker push 547600246465.dkr.ecr.eu-central-1.amazonaws.com/perevir_bot:latest
deploy_prod: push_image_prod
	@echo "Are you sure you want to deploy to PRODUCTION env? (yes/no)"
	@read CONFIRM && [ "$$CONFIRM" = "yes" ] || (echo "Aborted!" && exit 1)
	@echo "Deploying..."
	aws ecs describe-task-definition \
		--task-definition perevir-bot-prod-fargate \
		| jq -r ".taskDefinition | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)" > task-def.json
	REVISION=$(aws ecs register-task-definition \
		--cli-input-json file://task-def.json \
		| jq -r ".revision")
	aws ecs update-service \
	  --cluster perevir-bot-prod-fargate-cluster \
	  --service perevir-bot-prod \
	  --task-definition perevir-bot-prod-fargate:${REVISION} \
	  --force-new-deployment
	  rm task-def.json
deploy_stage: push_image_stage
	@echo "Are you sure you want to deploy STAGING env? (yes/no)"
	@read CONFIRM && [ "$$CONFIRM" = "yes" ] || (echo "Aborted!" && exit 1)
	@echo "Deploying..."
	aws ecs describe-task-definition \
		--task-definition perevir-bot-staging-fargate \
		| jq -r ".taskDefinition | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)" > task-def.json
	REVISION=$(aws ecs register-task-definition \
		--cli-input-json file://task-def.json \
		| jq -r ".revision")
	aws ecs update-service \
	  --cluster perevir-bot-staging-fargate-cluster \
	  --service perevir-bot-staging \
	  --task-definition perevir-bot-staging-fargate:${REVISION} \
	  --force-new-deployment
	rm task-def.json