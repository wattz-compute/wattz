# wattz-cli

Command-line toolkit for the Wattz Solana AI Inference Marketplace. Run a
GPU inference node, publish models to the on-chain registry, run inference
from the terminal, and manage stake / rewards.

## Install

```bash
npm install -g wattz-cli
# or run without installing:
npx wattz-cli --help
```

Requires Node.js 18+.

## Commands

```
wattz node init          Initialize the local node identity + keypair.
wattz node start         Start the local inference proxy (Ollama-backed).
wattz node status        Print runtime status.
wattz node stop          Stop the local runtime.

wattz model list         List models in the PDA registry.
wattz model publish      Publish a model manifest.

wattz infer              Run a single inference request.
wattz stake              Stake SOL on the Anchor program.
wattz claim              Claim accrued inference rewards.

wattz config show        Print the config.
wattz config get <key>   Read a config value.
wattz config set <key>   Write a config value.
wattz config path        Print the config file path.

wattz docs               Open the Wattz docs.
wattz version            Print CLI and SDK versions.
```

## First run

```bash
wattz node init --region self-hosted --model llama-3.1-8b-instant
# writes:
#   ~/.wattz/config.json
#   ~/.wattz/keypair.json (Solana operator identity)

# Ensure Ollama is installed and the model is pulled:
ollama pull llama3.1:8b

wattz node start
# Local proxy on 0.0.0.0:8081 that speaks the OpenAI Chat/Completions schema
# and registers with the Wattz gateway. Heartbeats every 30s.
```

## Inference from the terminal

```bash
wattz infer --model llama-3.1-8b-instant --prompt "Explain TEE attestation."
wattz infer --model llama-3.1-8b-instant --prompt "Stream me a haiku." --stream
echo "prompt from stdin" | wattz infer --model llama-3.1-8b-instant
```

## Publish a model manifest

`manifests/llama-3.1-8b.yaml`:

```yaml
id: llama-3.1-8b-instant
family: llama
parameters_b: 8
context_window: 131072
modality: text
license:
  spdx: Llama-3.1
  name: Llama 3.1 Community License
  commercial: true
  kyc_required: false
  upstream_url: https://www.llama.com/llama3_1/license/
price_per_1k_prompt: 50
price_per_1k_completion: 100
supported_regions: [us-east-1, eu-west-1, ap-south-1]
min_gpu_vram_gb: 24
```

```bash
wattz model publish --file manifests/llama-3.1-8b.yaml --dry-run
wattz model publish --file manifests/llama-3.1-8b.yaml
```

## Stake and claim

```bash
wattz config set programId <ANCHOR_PROGRAM_ID>
wattz stake --amount 10
wattz claim --dry-run
wattz claim
```

## Configuration

The config file lives at `~/.wattz/config.json`. Values can be overridden
per invocation with `--api <url>` or via environment variables:

- `WATTZ_API_KEY`
- `WATTZ_BASE_URL`
- `WATTZ_PROGRAM_ID`
- `WATTZ_HOME` (override the config directory)
- `WATTZ_DEBUG=1` (print debug diagnostics)
- `WATTZ_NO_COLOR=1` (disable ANSI colors)

## License

Apache-2.0.
