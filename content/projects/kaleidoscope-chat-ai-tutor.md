Late evening in the Mac lab.

Everyone else had gone home hours ago. I was staring at my screen, trying to figure out how to make a computer understand poetry.

Not just read it. *Understand* it.

The kind of understanding where a student could ask, "what is this story about?" at 2 AM and get an answer that actually helped. Not a Wikipedia summary. Not a generic chatbot response. Something that felt like talking to a teacher who'd read the book a hundred times.

That's what I was building. An AI tutor named Shalini, designed to help students explore their English textbook, a collection called Kaleidoscope, full of poems, short stories, dramas, and science fiction.

The problem was simple to state, hard to solve.

---

## The Core Problem

You can't just throw an entire book at an AI and expect magic.

I tried. It didn't work.

Think about it this way. If I asked you about a specific scene from a 500-page novel you read months ago, you wouldn't reread the whole thing. You'd flip to the relevant chapter. Find the scene. Use that context to answer.

That's what the AI needed to do.

The technique is called Retrieval Augmented Generation. RAG. Fancy name for a simple idea: don't make the AI remember everything. Make it look things up.

---

## Breaking the Textbook into Pieces

First challenge: chunking.

Like creating an index card system for your brain.

I divided the book into paragraphs. Roughly 300 words each. Not too big to overwhelm. Not too small to lose context.

Here's the trick that took me a while to figure out. Each chunk overlaps with the previous one by 100 words. Because meaning doesn't stop at paragraph boundaries. If a character is introduced at the end of one section and discussed in the next, the overlap keeps that connection alive.

Then I extracted the important stuff using natural language processing. Names. Places. Organizations. If a paragraph mentions Captain Hagberd or Colebrook from *Tomorrow*, those become searchable. Page numbers and author names get preserved too, so Shalini can tell students exactly where to find things in their physical book.

---

## Turning Words into Numbers

Computers don't understand words. They need numbers.

So I used something called an embedding model, specifically `all-roberta-large-v1` from HuggingFace. Think of it as a translator that converts each paragraph into a list of 1,024 numbers. A vector.

But these aren't random numbers.

Paragraphs with similar *meanings* get similar vectors. So if one section talks about love and sacrifice and another discusses devotion and selflessness, they end up close together in this 1,024-dimensional space. Even if they use completely different words.

It's like creating a map where similar ideas cluster together.

I remember the moment this clicked for me. Running a test query and watching the system pull up exactly the right passage from a chapter I'd almost forgotten about. Not because the words matched. Because the *meaning* matched.

---

## Storing and Searching: Qdrant

All these numbered paragraphs needed a home.

A special database called [Qdrant](https://qdrant.tech/), designed for exactly this kind of search. Unlike normal databases that look for exact matches, Qdrant finds the *closest* matches.

When a student asks "What motivated Captain Hagberd?", the system converts that question into a vector. Searches for paragraphs with similar vectors. Retrieves the top two most relevant chunks. Sends those as context to the AI.

For poems, I used something different. A `TreeIndex` from LlamaIndex. Poetry has unique structure and flow. It benefits from hierarchical organization.

---

## The Language Model: Llama on Groq

The actual thinking happens with `Llama-3.3-70b-versatile`, a large language model from Groq. Good at creative, nuanced responses. Perfect for literature discussions.

But I don't just let the AI ramble.

Using LangChain, I orchestrate everything. System prompts define Shalini's personality, helpful, encouraging, knowledgeable. Guardrails keep responses focused on literature education. Context integration weaves the retrieved paragraphs into coherent answers. Conversation memory means Shalini remembers what you discussed earlier.

---

## The Interface

The interface is built with Gradio, deployed on HuggingFace.

Each user gets their own conversation history. Previous messages display so you can follow the thread. A dropdown lets you focus on specific chapters. You can download chapters for reference.

Ask a question, get a thoughtful answer. Follow up naturally. "Can you explain that differently?" or "Tell me more about that character." Shalini provides page references so you can verify in your textbook.

---

## Tech Stack

Here's what powers it all:

- **LlamaIndex** : building and querying knowledge indices
- **LangChain** : orchestration, prompts, and guardrails
- **Qdrant** : semantic vector search
- **Gradio** : the user interface
- **HuggingFace** : deployment and embedding model
- **Groq** : fast LLM inference
- **NLTK** : entity extraction
- **Python** : tying it all together

---

## What I Learned Building This

Chunking matters more than I thought. How you break down knowledge dramatically affects what you get back. The 300-word chunks with 100-word overlap turned out to be the sweet spot. Took several failed attempts to find it.

Metadata is gold. Extracting entities and page numbers made responses precise and verifiable.

Context is everything. RAG outperforms pure language models because it grounds responses in actual content. The AI isn't making things up. It's working from the source.

And user experience matters. Technical sophistication means nothing if students don't find it easy to use. I spent more time on the interface than I expected. Worth every hour.

---

## What's Next

There's more I want to add someday. Multi-lingual support. Quiz generation. Visual analysis for illustrated pages. Study plans based on exam syllabus. Integration with note-taking apps.

But that's for later.

---

Late nights in the Mac lab, building something that might help a student understand a poem at 2 AM.

That's the part I'll remember.

Not the embedding dimensions or the chunk sizes. The feeling of watching it work for the first time. A question going in, the right answer coming out, grounded in the actual textbook.

Learning shouldn't feel like pulling teeth.

It should feel like talking to someone who genuinely wants to help you understand.

That's what Shalini is. An AI tutor who knows the book. Remembers your conversation. Points you to the page.

A teacher who never sleeps.
