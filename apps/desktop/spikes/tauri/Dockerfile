ARG BASE_IMAGE=ubuntu:24.04
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive \
    RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PATH=/opt/cargo/bin:${PATH}

RUN apt-get -o Acquire::ForceIPv4=true -o Acquire::Retries=10 update \
    && apt-get -o Acquire::ForceIPv4=true -o Acquire::Retries=10 install --yes --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        file \
        libayatana-appindicator3-dev \
        libgstreamer1.0-0 \
        libgtk-3-dev \
        libssl-dev \
        libwebkit2gtk-4.1-dev \
        libxdo-dev \
        librsvg2-dev \
        mesa-utils \
        patchelf \
        pkg-config \
        wget \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain stable \
    && rustup component add clippy rustfmt \
    && chmod -R a+rX /opt/rustup /opt/cargo

WORKDIR /workspace

CMD ["cargo", "--version"]
