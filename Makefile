.PHONY: test coverage ci

test:
	npm test

coverage:
	npm run coverage:gate

ci:
	npm run ci
