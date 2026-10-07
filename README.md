## Cette documentation est technique. Pour plus d'informations sur le [simulateur d'aides pour les jeunes](https://mes-aides.1jeune1solution.beta.gouv.fr), regardez notre [wiki](https://github.com/DNUM-SocialGouv/aides-jeunes/wiki).

> L'interface utilisateur (et le serveur principal) du [simulateur d'aides et de prestations sociales pour les jeunes](https://mes-aides.1jeune1solution.beta.gouv.fr). Il est basé sur simulateur socio-fiscal libre [Openfisca](https://www.openfisca.fr/).

# Setup

## Stack

- VueJS
- NodeJS
- MongoDB
- OpenFisca (Python, numpy)
- NetlifyCMS ([config](https://github.com/DNUM-SocialGouv/aides-jeunes/blob/main/contribuer/public/admin/config.yml))
  - [website](https://contribuer-aides-jeunes.netlify.app)
- Ansible ([aides-jeunes-ops](https://github.com/DNUM-SocialGouv/aides-jeunes-ops))

## 3rd parties

- Github Actions ([config](https://github.com/DNUM-SocialGouv/aides-jeunes/blob/main/.github/workflows/))
  - Continuous integration and deployment
- Netlify
  - Deloy previews
- SMTP server
- Matomo ([stats.beta.gouv.fr](https://stats.beta.gouv.fr/index.php?module=CoreHome&action=index&idSite=63&period=range&date=previous30))
  - [Dedicated site for usage data and impact](https://dnum-socialgouv.github.io/mes-aides-analytics/) [source](https://github.com/DNUM-SocialGouv/mes-aides-analytics)
- Sentry
  - [backend](https://sentry.io/organizations/betagouv-f7/projects/aides-jeunes-node/?project=5709109)
  - [frontend](https://sentry.io/organizations/betagouv-f7/projects/aides-jeunes-front/?project=5709078)

# Front only install

If you want to play with the UI, you can be set up very quickly:

```bash
npm ci
npm run front
```

Cf. `package.json` for more on the underlying commands.

The application should be accessible at `localhost:8080`.

# Full install

## System dependencies

Make sure `node` 18.x is installed on your machine:

### Ubuntu

And also `build-essential`, `mongodb` are installed on your machine:

```sh
sudo apt-get install build-essential
sudo apt-get install mongodb
```

### MacOs

And also `brew` is installed on your machine:

```sh
brew tap mongodb/brew # Download official homebrew formula for MongoDb
brew update # Update Homebrew and all existing formulae
brew install mongodb-community@7.0 # Install MongoDb
```

### For all platforms

The runtime is Node 18.x for the web application, and Python >= 3.9 for Openfisca.

You can for example use [`nvm`](https://github.com/creationix/nvm) to install this specific version.

You will need [`pip`](https://pip.pypa.io/) to install Openfisca.

## Application

Run the following from the root of the project to install the dependencies

```sh
npm ci
```

## Openfisca

There are 2 ways to run Openfisca:

- either by installing its dependencies in a Python virual environment locally on your machine
- or by using Docker to pull and build an image with the required dependencies

### Install Openfisca in a virtual environment

You should [install Python 3 in a virtual environment](https://virtualenv.pypa.io/en/stable/) to prevent yourself from messing with your main python installation. The instructions below rely on the built-in `venv` module so that there are no additional external dependencies:

```bash
python3 -m venv .venv   # create the virtual environment in the .venv folder
source .venv/bin/activate  # activate the virtual environment
pip install pip --upgrade  # make sure we're using the latest pip version
npm run install-openfisca  # install dependencies
```

Then, to start the OpenFisca server, simply run `source .venv/bin/activate` followed by `npm run openfisca`.

OpenFisca dependencies are specified in [openfisca/requirements.txt](https://github.com/DNUM-SocialGouv/aides-jeunes/blob/main/openfisca/requirements.txt), a basic [Python requirements file](https://pip.pypa.io/en/stable/reference/pip_install/#example-requirements-file). It is possible to refer to non-production commit hashs but is prefered to use _main-merged_ commits.

### Install and run Openfisca in a docker container

If you want to run Openfisca without having to install a specific version of Python or create a virtual environment you can use the docker file provided to run Openfisca in a container. From the root of the project run the following command to build the docker image:

```bash
docker build -f openfisca/Dockerfile ./openfisca -t openfisca
```

### Development mode

If you are working on `openfisca-france` and want to use your local version:

```
cd (...)/openfisca-france
pip install --editable .
```

## Test in production mode

If you want to test locally the app in production mode:

```sh
npm run build
npm run start
```

## Usage

First, start a Mongo server:

```sh
npm run db
```

Then, in another shell you will need to start openfisca. If you installed it locally activate the virtual environment (run `source .venv/bin/activate`) and start the Openfisca server:

```sh
OPENFISCA_WORKERS=1 npm run openfisca
```

If instead you want to run Openfisca in a docker container run:

```bash
docker run -d -p 2000:2000 openfisca
```

(note that in that case Openfisca will run in the background and you will have to run `docker ps` and `docker stop XXXXX` where XXXXX is the container ID to stop Openfisca)

Finally, in a third shell, start the server:

```sh
npm run serve
```

# Testing

There are several levels of tests:

- Unit tests are executed by [Vitest](https://vitest.dev/) and run with `npm test`.
- End-to-end test are executed with [Cypress](https://www.cypress.io/) with `npm run cypress`

You can safely use `npm test && npm run cypress` to drive your developments.

## Development Environment and Cypress

In Cypress tests, we verify that email functionality works. To check this locally, you need to copy and paste the environmental variables from .env.e2e to your .env file (and create the .env file if you don't already have one).

## Email

We use the framework [MJML](https://mjml.io/) to design and integrate the templates. [Tipimail](https://fr.tipimail.com) is our service to send emails.

The development server for emails can be easily start with: `npm run tools:serve-mail`

If you want to verify the email sending process, you can generate a set of the required `SMTP_*` environment variables by running `ts-node tools/create-temp-smtp-server.ts` to generate a test account on `https://ethereal.email`.

## Linting and format

We use [ESLint](https://eslint.org/) as a linter and [Prettier](https://prettier.io/) to format the codebase.
We also utilize some ESLint plugins, such as [vue-eslint](https://eslint.vuejs.org/user-guide/) and [eslint-plugin-cypress](https://github.com/cypress-io/eslint-plugin-cypress), to provide a support for tests and framework.

# Continuous deployment

SSHs keys were generated to [run scripts](http://man.openbsd.org/sshd#command=%22command%22) on the production server.

The `main` and `dev` branches are automatically deployed on the production server when they are updated using a [continuous deployment script](https://github.com/DNUM-SocialGouv/aides-jeunes/actions/workflows/cd.yml).

Note that it is also possible to re-trigger a deployment manually by clicking on `Run workflow` button on the [continuous deployment's page](https://github.com/DNUM-SocialGouv/aides-jeunes/actions/workflows/cd.yml) and selecting either the `main` or `dev` branch.

To access the applications server it is possible to connect to it with a registered public key using ssh:

```sh
ssh debian@equinoxe.mes-aides.1jeune1solution.beta.gouv.fr
```

# Other tools scripts & tips

In order to use those tools you need to build the server at least once using the command `npm run build:server`.

- `npm run husky` installs git hooks used to facilitate development and reduce the CI running time. We use Talisman to to ensure that potential secrets or sensitive information do not leave the developer's workstation. You need to install Talisman before : https://github.com/thoughtworks/talisman/releases or `brew install talisman`. To skip talisman, you can use -n when you commit.

- `npm run tools:check-links-validity` validates links to 3rd parties in benefits files.

- `npm run tools:cleaner` cleans simulations data older than 31 days.

- `npm run tools:evaluate-benefits <simulationId>` evaluates benefits linked to a simulation id.

- `npm run tools:generate-missing-institutions-aides-velo` generates missing institutions for the package `aides-velo`.

- `npm run tools:download-incitations-covoiturage-generate-missing-institutions` download new carpooling incentives and generates missing epci for the Open Data `Registre de Preuve de Covoiturage`.

- `npm run tools:geographical-benefits-details` gets the relevant benefits for each commune.

- `npm run tools:get-all-steps` gets all the steps and substeps of a simulation.

- `npm run tools:serve-mail` generates emails which contain the result of a simulation or a survey.

- `npm run tools:test-benefits-geographical-constraint-consistency` validates geographical constraint consistency of benefits.

- `npm run tools:test-definition-periods`validates the periods of openfisca requested variables.

- [Locally](http://localhost:8080/simulation/resultats?debug) or on [production](https://mes-aides.1jeune1solution.beta.gouv.fr/simulation/resultats?debug), it is possible to visualize all the available benefits of the simulator. It is done by adding `debug` as a parameter. It is also possible to set `debug=ppa,rsa` to choose which benefits are listed.

- Adding `debug=parcours` as a parameter, show a debug version of all the steps in the simulator, [locally](https://localhost:8080/simulation/individu/demandeur/date_naissance?debug=parcours) and [production](https://mes-aides.1jeune1solution.beta.gouv.fr/simulation/individu/demandeur/date_naissance?debug=parcours).

- [OpenFisca tracer](https://openfisca.github.io/tracer/) allows you to debug OpenFisca computations. ([source](https://github.com/openfisca/tracer))

# Export simulations data from database

It is possible to generate simulation statistics from the database running the commande `npm run tools:generate-mongo-stats`.

This will generate 3 csv files in the `dist/documents` folder:

- `monthly_activite.csv` that lists the number of simulations per activity for each month
- `monthly_age.csv` that lists the number of simulations per age for each month
- `monthly_geo.csv` that lists the number of simulations per epci, departement and regions for each month

## Decap CMS development

It is possible to locally debug changes in Decap CMS configuration.

- `npm ci` and `npm run dev` should be ran from `contribuer`.
- Decap CMS should now be accessible at `http://localhost:3000/admin/index.html`

If you want changes to be made locally instead of generating pull requests in production:

- First, [contribuer/public/admin/config.yml#L19](https://github.com/DNUM-SocialGouv/aides-jeunes/blob/main/contribuer/public/admin/config.yml#L19) ([`local_backend: true`](https://decapcms.org/docs/working-with-a-local-git-repository)) must be uncommented;
- `npx netlify-cms-proxy-server` should be ran from `.` and

## Check Link Validity

Some parameters can be use to debug the command

- `--dry-run` : this command is useful to not send update/new row to Grist
- `--no-priority` : without getting priority from analytic data
- `--only [slug benefit]` : work on specific benefit

Here is an example of how using this parameters
`npm run tools:check-links-validity -- --dry-run`

## Download carpooling incentives and generate missing ecpi

The data source comes from this : https://www.data.gouv.fr/fr/datasets/conditions-des-campagnes-dincitation-financiere-au-covoiturage/
We use Grist to add custom informations like, if a benefit is link to an institution or epci, ...
One parameter can be use to debug the command

- `--no-download` : avoid download new data from Grist

Here is an example of how using this parameters
`npm run tools:download-incitations-covoiturage-generate-missing-institutions -- --no-download`
