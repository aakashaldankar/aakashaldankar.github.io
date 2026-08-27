I've been reading about LoRA and QLoRA for months.

The mathematics. The intuition behind low-rank decomposition. The papers. I understood the concepts well enough to explain them. But I hadn't actually done it.

That gap bothered me. So I decided to close it.

I chose a medical reasoning dataset deliberately. Not because it was easy, it's one of the harder domains to get right, but because a model that can reason like a healthcare professional is actually useful to the world. A wrong answer in that domain costs more than a wrong answer about movie trivia. That felt like the right kind of pressure to work under.

---

## Why Fine-Tuning Exists

General-purpose LLMs like GPT, Claude, and Llama are trained on everything, history, code, recipes, art, science, literature. That breadth makes them useful for everyday tasks. It also makes them shallow in domains where real expertise matters.

A hospital can't deploy a general-purpose model for cardiac diagnosis. The model needs deep domain knowledge, it needs to follow medical reasoning patterns, and critically the hospital can't send patient data to an external server. Privacy laws alone make that impossible.

The solution is fine-tuning: take an already-trained general-purpose model and continue training it on domain-specific data. Think of it like a first-year medical student who has already learned how to read, write, think critically, and communicate, and now specialises in cardiology. You're not starting from scratch. You're redirecting existing capability.

Fine-tuning still required significant compute, until LoRA changed that.

---

## The Approach: QLoRA

QLoRA stands for Quantized Low-Rank Adaptation. It combines two ideas that individually make fine-tuning cheaper, and together make it possible on consumer hardware.

**Quantization** compresses the model's weights from 32-bit or 16-bit floating point numbers down to 4-bit precision. This cuts memory usage by roughly 4–8x. The model's original weights are frozen in this compressed form and never updated during training.

**LoRA** (Low-Rank Adaptation) adds small trainable matrices into specific layers of the frozen model. Instead of updating all 1 billion parameters, which requires storing gradients for all of them, LoRA only trains these tiny "adapter" matrices. The result: instead of 262 million trainable parameters, we end up with 11.27 million. That's 1.48% of the total. The rest stays frozen.

The analogy: imagine you've hired a specialist consultant to work alongside a large team. The team doesn't change. The consultant adds targeted expertise on top. When you're done, you can either keep the consultant separate or merge their recommendations into the team's standard procedure.

---

## What I Was Working With

**The model:** Llama 3.2 1B by Meta. One billion parameters. I wanted a model large enough to have genuine language understanding, but small enough to fine-tune on a T4 GPU without paying for cloud compute. In the 1B parameter class, Llama 3.2 1B is the best available, fast to train, memory-efficient, and strong baseline quality.

**The hardware:** NVIDIA T4 GPU on Google Colab (free tier). The T4 has 16 GB of GDDR6 memory and roughly 2,500 CUDA cores. Without QLoRA, fine-tuning even a 1B model would overflow this. With QLoRA, it fits with room to spare.

**The dataset:** [OpenMed/Medical-Reasoning-SFT-Mega](https://huggingface.co/datasets/OpenMed/Medical-Reasoning-SFT-Mega), a large collection of medical question-answer pairs for supervised fine-tuning (SFT means teaching the model by showing it correct input-output examples, rather than by reward signals). The full dataset has 1,789,998 pairs totalling 3.78 billion tokens.

I used 100 pairs for this run. That's a tiny fraction of the full dataset, and it's the honest limitation of this experiment. The goal was to prove the pipeline works end-to-end on constrained hardware, not to produce a production-ready medical assistant. On the full dataset, training would take well over a day on a T4.

---

## Libraries and Their Roles

- **`transformers`** : Hugging Face's core library. Loads the model, tokenizer, and training arguments.
- **`peft`** : Parameter-Efficient Fine-Tuning. Applies the LoRA adapters to the model.
- **`trl`** : Transformer Reinforcement Learning. Provides `SFTTrainer`, which handles the supervised fine-tuning loop.
- **`bitsandbytes`** : Enables 4-bit quantization (the "Q" in QLoRA) and memory-efficient optimizers.
- **`accelerate`** : Handles device mapping and mixed-precision training.
- **`datasets`** : Loads and processes the Hugging Face dataset.
- **`wandb`** : Weights & Biases. Tracks training metrics, loss curves, and GPU utilization in real time.
- **`ollama`** : Lightweight local inference server for running the merged model after training.
- **`vllm`** : High-throughput batch inference engine (requires an A100 GPU, not used in this run).

---

## Loading the Model: Quantization Config

To load Llama 3.2 1B in 4-bit quantized form, I configured `BitsAndBytesConfig` with the following:

- `load_in_4bit = True` : load the model at 4-bit precision instead of the default 16-bit or 32-bit
- `bnb_4bit_quant_type = "nf4"` : NormalFloat4, a 4-bit data type designed specifically for normally-distributed neural network weights; more accurate than plain INT4
- `bnb_4bit_compute_dtype = torch.bfloat16` : computations still happen in bfloat16 during the forward pass, even though weights are stored in 4-bit
- `bnb_4bit_use_double_quant = True` : quantizes the quantization scaling constants themselves, saving an extra ~0.4 bits per parameter
- `device_map = "auto"` : automatically distributes model layers across available GPU and CPU
- `use_cache = False` : disables the KV-cache during training, which is incompatible with gradient checkpointing

After loading with these settings, the model had 750 million trainable parameters, down from 1 billion, because quantization folds some structure. Before adding LoRA, 262.74 million of those were technically trainable. That's still far too many to update efficiently on a T4.

---

## Applying LoRA Adapters

Two steps happened here.

First, `prepare_model_for_kbit_training()` casts certain layers (like LayerNorm) back to full precision, enables gradient checkpointing, which trades training speed for memory by recomputing intermediate activations during backpropagation instead of storing them, and prepares the quantized model to accept adapters.

Second, `get_peft_model()` injects LoRA adapter matrices into four attention projection layers: `q_proj`, `k_proj`, `v_proj`, and `o_proj`. These are the layers responsible for how the model attends to different parts of the input.

The LoRA configuration:

- `LORA_R = 16` : the rank of the adapter matrices; higher rank means more expressiveness, more parameters, more memory
- `LORA_ALPHA = 32` : a scaling factor; convention is to set it to 2× the rank
- `LORA_DROPOUT = 0.05` : regularization to prevent the adapters from overfitting on small datasets

After applying LoRA, trainable parameters dropped from 262 million to 11.27 million, 1.48% of total parameters. Everything else is frozen. This is what makes QLoRA tractable on a 16 GB GPU.

---

## Baseline: Before Training

Before training, I ran inference on 5 test questions from the medical dataset.

This wasn't just good practice, it was necessary. Without a baseline, I'd have no way to know whether the fine-tuning actually improved anything. I used the same 5 questions after training to make the comparison direct.

The pre-training answers were vague and general. The model understood the questions but responded like a well-read undergraduate, not a clinician.

---

## Dataset Preprocessing

Each row in the dataset needed to be formatted so Llama knows what counts as input and what counts as output. I wrote a function `format_to_text` that converts each dataset row into a chat-formatted string using Llama's built-in chat template. It handles two schemas: a `messages` format and a flat `instruction/output` format.

This preprocessing step is often overlooked in tutorials but it matters. If the model can't tell where the question ends and the answer begins, the training signal is noise.

---

## Training Configuration

`SFTTrainer` from the `trl` library handled the training loop. The key settings were all chosen to fit the T4's 16 GB VRAM:

- `optim = "paged_adamw_8bit"` : a memory-paged variant of AdamW that stores optimizer states in 8-bit and offloads them to CPU when not needed; without this, the optimizer states alone would overflow the GPU
- `gradient_checkpointing = True` : recomputes activations during backprop instead of storing them; slower but much more memory-efficient
- `fp16 = True` : mixed precision training: forward pass in half precision, gradients accumulated in full precision
- `group_by_length = True` : batches samples of similar length together to minimize padding waste
- `per_device_train_batch_size = 2` with `gradient_accumulation_steps = 8` : effective batch size of 16 without needing 16 samples in GPU memory simultaneously
- `learning_rate = 2e-4` with cosine decay and 5% warmup
- `max_seq_length = 1024` : maximum token length per training sample
- `packing = False` : each example gets its own sequence

---

## Results

Training ran for 10 minutes on 100 question-answer pairs, 2 epochs, on the T4 GPU.

Final training metrics: epochs completed 1.88, training loss **2.054**, throughput 0.287 samples per second.

A loss of 2.054 after just 2 epochs on 100 samples is a reasonable starting point, not a polished result. I'm not 100% sure what the loss curve looked like in detail across both epochs, I didn't save per-step metrics granularly. My intuition tells me the loss was dropping meaningfully in the first epoch and levelling off in the second, which is typical behaviour when fine-tuning on a very small dataset.

The throughput of 0.287 samples per second is slow. That's a direct consequence of gradient checkpointing and the T4's memory constraints. Recomputing activations during backpropagation takes time. On an A100 with the full dataset, throughput would be orders of magnitude higher.

After training, I saved the LoRA adapter weights locally. The adapters are roughly 50–200 MB, a small add-on to the 750 MB base model.

---

## Before vs After: The Output Difference

I ran the same 5 test questions through the fine-tuned model and compared the outputs side by side in the notebook.

The difference was clear.

Before fine-tuning, the model gave general answers, technically not wrong, but the kind of answer you'd get from someone who has read about medicine rather than practiced it. The language was cautious and non-specific.

After fine-tuning on just 100 medical question-answer pairs, the tone shifted. Answers were more structured. Terminology was used correctly and precisely. The reasoning followed the pattern of how a clinician actually thinks through a differential diagnosis, presenting the most likely cause first, noting contraindications, acknowledging what further investigation would be needed.

That is the effect of fine-tuning in plain terms: same base model, entirely different register.

> **Honest limitation:** this model was trained on 100 samples for 2 epochs. It should not be used for anything clinical. It demonstrates the mechanism. It is not a finished product.

---

## Discussion

What this experiment showed me is that the barrier to fine-tuning is genuinely low now.

A few years ago, fine-tuning a 1B parameter model required hardware most small teams couldn't access. QLoRA removed that constraint. A free Colab GPU and an afternoon is now enough to produce a demonstrably specialized model from a general-purpose base.

The more interesting question is what this means for specialized domains. A hospital with patient data it can't share externally can fine-tune an open-source model entirely on its own infrastructure. The fine-tuning dataset stays local. The adapted model stays local. The big-lab dependency disappears.

What I'd want to do next is run the same experiment on a larger dataset, ideally 10,000 to 50,000 samples, on an A100. I'd expect the before/after quality gap to widen significantly. I'd also want to evaluate the model properly: not just impressionistic quality comparison, but BLEU scores or medical benchmark performance before and after.

The merge step is worth noting too. After fine-tuning, the LoRA adapters can be merged into the base model weights to produce a standalone model that runs without the PEFT library, which makes it compatible with Ollama and vLLM for local deployment.
