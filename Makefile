SHELL := /bin/bash
ENV_FILE ?= .env.production

ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export $(shell sed -n 's/=.*//p' $(ENV_FILE))
endif

API_IMAGE ?= $(DOCKER_REGISTRY)-api
ADMIN_IMAGE ?= $(DOCKER_REGISTRY)-admin-web
PROXY_IMAGE ?= $(DOCKER_REGISTRY)-reverse-proxy
IMAGE_TAG ?= latest

.PHONY: bootstrap dev dev-api dev-admin build lint test migrate docker-up docker-down docker-build push-images deploy ssh

bootstrap:
	pnpm install

dev:
	pnpm dev

dev-api:
	pnpm dev:api

dev-admin:
	pnpm dev:admin

build:
	pnpm build

lint:
	pnpm lint

test:
	pnpm test

migrate:
	pnpm migrate

docker-up:
	ENV_FILE=$(ENV_FILE) pnpm docker:up

docker-down:
	pnpm docker:down

docker-build:
	ENV_FILE=$(ENV_FILE) pnpm docker:build

push-images:
	@test -n "$(DOCKER_REGISTRY)" || (echo "DOCKER_REGISTRY must be set" && exit 1)
	docker build -f apps/api/Dockerfile -t $(API_IMAGE):$(IMAGE_TAG) .
	docker push $(API_IMAGE):$(IMAGE_TAG)
	docker build -f apps/admin-web/Dockerfile -t $(ADMIN_IMAGE):$(IMAGE_TAG) --build-arg VITE_API_BASE_URL=$(VITE_API_BASE_URL) .
	docker push $(ADMIN_IMAGE):$(IMAGE_TAG)
	docker build -f infra/nginx/Dockerfile -t $(PROXY_IMAGE):$(IMAGE_TAG) infra/nginx
	docker push $(PROXY_IMAGE):$(IMAGE_TAG)

ssh:
	@test -n "$(SSH_DEPLOY_HOST)" || (echo "SSH_DEPLOY_HOST must be set" && exit 1)
	ssh $(SSH_DEPLOY_HOST)

deploy:
	@test -n "$(SSH_DEPLOY_HOST)" || (echo "SSH_DEPLOY_HOST must be set" && exit 1)
	@test -n "$(SSH_DEPLOY_DIR)" || (echo "SSH_DEPLOY_DIR must be set" && exit 1)
	ssh $(SSH_DEPLOY_HOST) 'mkdir -p $(SSH_DEPLOY_DIR)'
	scp docker-compose.deploy.yml $(ENV_FILE) $(SSH_DEPLOY_HOST):$(SSH_DEPLOY_DIR)/
	ssh $(SSH_DEPLOY_HOST) 'cd $(SSH_DEPLOY_DIR) && ENV_FILE=$(ENV_FILE) IMAGE_TAG=$(IMAGE_TAG) DOCKER_REGISTRY=$(DOCKER_REGISTRY) docker compose -f docker-compose.deploy.yml pull && ENV_FILE=$(ENV_FILE) IMAGE_TAG=$(IMAGE_TAG) DOCKER_REGISTRY=$(DOCKER_REGISTRY) docker compose -f docker-compose.deploy.yml up -d'
