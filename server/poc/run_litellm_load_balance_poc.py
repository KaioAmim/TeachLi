#!/usr/bin/env python3
"""Run 50 concurrent requests through LiteLLM to two local fake providers."""

import concurrent.futures
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


REQUESTS = 50
MASTER_KEY = "sk-poc-local-only-12345678901234567890123456789012"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class MockProviderHandler(BaseHTTPRequestHandler):
    provider_name = ""
    request_count = 0
    count_lock = threading.Lock()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        self.rfile.read(length)
        with self.count_lock:
            type(self).request_count += 1
        body = json.dumps({
            "id": f"poc-{self.provider_name}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": f"mock-{self.provider_name}",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": f"servido-por-{self.provider_name}"},
                "finish_reason": "stop",
            }],
            "usage": {"prompt_tokens": 12, "completion_tokens": 1, "total_tokens": 13},
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def start_mock(name):
    port = free_port()
    handler = type(f"{name}Handler", (MockProviderHandler,), {
        "provider_name": name,
        "request_count": 0,
        "count_lock": threading.Lock(),
    })
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, handler, port


def wait_until_ready(base_url, process):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("LiteLLM encerrou durante a inicialização.")
        try:
            with urllib.request.urlopen(base_url + "/health/liveliness", timeout=1):
                return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.25)
    raise TimeoutError("LiteLLM não ficou pronto em 90 segundos.")


def request_summary(base_url, barrier, request_id):
    body = json.dumps({
        "model": "resumo-aula",
        "messages": [{"role": "user", "content": f"resumo de teste {request_id}"}],
        "max_tokens": 20,
    }).encode()
    req = urllib.request.Request(
        base_url + "/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {MASTER_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    barrier.wait(timeout=15)
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=45) as response:
        payload = json.load(response)
        provider = payload["choices"][0]["message"]["content"]
        return provider, time.perf_counter() - started


def main():
    litellm = shutil.which("litellm")
    if not litellm:
        print("LiteLLM Proxy não encontrado no PATH. Instale-o em um ambiente isolado com: python -m pip install 'litellm[proxy]'", file=sys.stderr)
        return 2

    providers = [start_mock("a"), start_mock("b")]
    proxy_port = free_port()
    base_url = f"http://127.0.0.1:{proxy_port}"
    config = f'''model_list:
  - model_name: resumo-aula
    litellm_params:
      model: openai/mock-a
      api_base: http://127.0.0.1:{providers[0][2]}/v1
      api_key: mock-key-a
      weight: 1
  - model_name: resumo-aula
    litellm_params:
      model: openai/mock-b
      api_base: http://127.0.0.1:{providers[1][2]}/v1
      api_key: mock-key-b
      weight: 1
router_settings:
  routing_strategy: simple-shuffle
  num_retries: 1
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
'''

    with tempfile.TemporaryDirectory(prefix="teachli-litellm-poc-") as temp_dir:
        config_path = os.path.join(temp_dir, "config.yaml")
        with open(config_path, "w", encoding="utf-8") as file:
            file.write(config)
        env = {**os.environ, "LITELLM_MASTER_KEY": MASTER_KEY}
        log_path = os.path.join(temp_dir, "litellm.log")
        with open(log_path, "w", encoding="utf-8") as log_file:
            process = subprocess.Popen(
                [litellm, "--config", config_path, "--host", "127.0.0.1", "--port", str(proxy_port)],
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
            )
            try:
                wait_until_ready(base_url, process)
                barrier = threading.Barrier(REQUESTS + 1)
                started = time.perf_counter()
                with concurrent.futures.ThreadPoolExecutor(max_workers=REQUESTS) as pool:
                    futures = [pool.submit(request_summary, base_url, barrier, index) for index in range(REQUESTS)]
                    barrier.wait(timeout=15)
                    results = [future.result(timeout=60) for future in futures]
                elapsed = time.perf_counter() - started
                distribution = {"a": 0, "b": 0}
                for provider, _duration in results:
                    if provider not in ("servido-por-a", "servido-por-b"):
                        raise RuntimeError(f"Resposta inesperada do endpoint: {provider}")
                    distribution[provider[-1]] += 1
                if min(distribution.values()) == 0:
                    raise RuntimeError(f"O balanceador não distribuiu chamadas pelos dois endpoints: {distribution}")
                latencies = sorted(duration for _, duration in results)
                print(f"Resultado: {len(results)}/{REQUESTS} respostas válidas")
                print(f"Distribuição: endpoint A={distribution['a']}, endpoint B={distribution['b']}")
                print(f"Concorrência máxima: {REQUESTS} chamadas simultâneas")
                print(f"Tempo total: {elapsed:.2f}s; p50={latencies[len(latencies)//2]:.2f}s; p95={latencies[int(len(latencies)*0.95)-1]:.2f}s")
                print("Custo de provedores: zero nesta prova; os dois destinos são simuladores locais.")
                return 0
            except Exception:
                try:
                    with open(log_path, encoding="utf-8", errors="replace") as log_file:
                        tail = log_file.read()[-5000:]
                    if tail:
                        print("\nÚltimas mensagens do LiteLLM:\n" + tail, file=sys.stderr)
                except OSError:
                    pass
                raise
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
                for server, _handler, _port in providers:
                    server.shutdown()
                    server.server_close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"POC falhou: {error}", file=sys.stderr)
        raise SystemExit(1)
