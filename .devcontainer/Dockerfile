FROM trailofbits/eth-security-toolbox as base

# Setup env
ENV PATH=./node_modules/.bin:/home/ethsec/.local/bin:$PATH

USER root
WORKDIR /root

RUN sudo apt-get purge -y nodejs npm \
    && sudo apt-get autoremove -y

# Install OS packages
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get -y upgrade \
    && DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt-get -y install openssh-client sudo git curl build-essential wget \
    && apt-get clean

RUN curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash - \
    && sudo apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@latest \
    && npm install --global yarn \
    && node --version \
    && npm --version \
    && yarn --version

# Install global node modules
ENV HOME=/root
RUN npm install -g @graphprotocol/graph-cli \
    && npm install -g ganache-cli \
    && npm install -g hardhat-shorthand
ENV HOME=/home/ethsec

# Fix login shell
RUN usermod -s /bin/bash ethsec

USER ethsec
WORKDIR /home/ethsec

