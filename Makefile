.PHONY: setup run clean

venv:
	python3 -m venv venv

setup: venv
	./venv/bin/pip install -r requirements.txt

run:
	./venv/bin/python -m src.main

down:
	pkill -f "src.main" || true
	
clean:
	rm -rf venv
	find . -type d -name "__pycache__" -exec rm -rf {} +

db-up:
	docker compose up -d

db-down:
	docker compose down

db-clean:
	docker compose down -v