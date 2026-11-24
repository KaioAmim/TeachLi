#!/usr/bin/env python3
"""One-time setup for the Ollama runtime and the configured local model."""

import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_MODEL = "qwen2.5:7b"
DEFAULT_BASE_URL = "http://127.0.0.1:11434"
INSTALLER_URL = "https://ollama.com/install.sh"
WINDOWS_INSTALLER = "https://ollama.com/install.ps1"


def ask(message):
    try:
        return input(message).strip().casefold() in ("s", "sim", "y", "yes")
    except EOFError:
        return False


def find_ollama():
    executable = shutil.which("ollama")
    if executable:
        return executable
    for candidate in ("/usr/local/bin/ollama", os.path.expanduser("~/.ollama/ollama")):
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def install_ollama():
    system = platform.system()
    print("O Ollama não foi encontrado nesta máquina.")
    if not ask("Deseja instalar o Ollama usando o instalador oficial? [s/N] "):
        return False

    try:
        if system in ("Linux", "Darwin"):
            with urllib.request.urlopen(INSTALLER_URL, timeout=30) as response:
                installer = response.read()
            result = subprocess.run(["sh"], input=installer, check=False)
        elif system == "Windows":
            result = subprocess.run([
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                f"irm {WINDOWS_INSTALLER} | iex",
            ], check=False)
        else:
            print(f"Instalação automática não disponível para {system}. Baixe o Ollama em https://ollama.com/download")
            return False
    except (OSError, urllib.error.URLError) as error:
        print(f"Não foi possível executar o instalador do Ollama: {error}")
        return False

    if result.returncode != 0:
        print("O instalador do Ollama terminou com erro. Confira as mensagens acima e tente novamente.")
        return False
    executable = find_ollama()
    if not executable:
        print("O Ollama foi instalado, mas ainda não está no PATH. Feche e abra o terminal e rode npm run setup:ollama novamente.")
        return False
    return executable


def get_models(base_url):
    request = urllib.request.Request(base_url.rstrip("/") + "/api/tags")
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return {model.get("name") or model.get("model") for model in payload.get("models", [])}


def wait_for_server(base_url, executable):
    try:
        return get_models(base_url)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        pass

    print("Iniciando o serviço Ollama para preparar o modelo…")
    options = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if platform.system() == "Windows":
        options["creationflags"] = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        options["start_new_session"] = True
    try:
        subprocess.Popen([executable, "serve"], **options)
    except OSError as error:
        print(f"Não foi possível iniciar o Ollama: {error}")
        return None

    for _ in range(60):
        time.sleep(1)
        try:
            return get_models(base_url)
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            continue
    print("O serviço Ollama não respondeu. Inicie-o e rode npm run setup:ollama novamente.")
    return None


def main():
    model = os.environ.get("OLLAMA_MODEL", DEFAULT_MODEL)
    base_url = os.environ.get("OLLAMA_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    executable = find_ollama()
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    host = urllib.parse.urlparse(base_url).hostname

    if host not in local_hosts:
        try:
            installed_models = get_models(base_url)
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            print(f"Não foi possível acessar o Ollama remoto em {base_url}. Verifique o endereço e a rede.")
            return 1
        if model in installed_models:
            print(f"O Ollama remoto está pronto e o modelo {model} já está instalado.")
            return 0
        print(f"O modelo {model} não está instalado no Ollama remoto. Baixe-o nessa máquina com: ollama pull {model}")
        return 1
    if not executable:
        executable = install_ollama()
        if not executable:
            return 1

    installed_models = wait_for_server(base_url, executable)
    if installed_models is None:
        return 1
    if model in installed_models:
        print(f"O Ollama está pronto e o modelo {model} já está instalado.")
        return 0

    print(f"O modelo {model} ainda não está instalado. O download ocupa cerca de 4,7 GB.")
    if not ask("Deseja baixar o modelo agora? [s/N] "):
        print(f"Para instalar depois, execute: ollama pull {model}")
        return 1
    result = subprocess.run([executable, "pull", model], check=False)
    if result.returncode != 0:
        print("Não foi possível baixar o modelo. Confira a conexão e tente npm run setup:ollama novamente.")
        return result.returncode or 1
    print(f"Configuração concluída. {model} está pronto para o TeachLi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
