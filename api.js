// QuickNotes API client. It talks to JSONPlaceholder, a free practice API.

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

const loadBtn = document.querySelector("#load-btn");
const statusMessage = document.querySelector("#status");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");
const notesList = document.querySelector("#notes-list");

let notes = [];
let isBusy = false;

// ---------- Helpers ----------

// type is "loading", "success" or "error" (it decides the colour in style.css)
function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = type ? `status ${type}` : "status";
}

// Disables every button while a request is running
function setBusy(busy) {
  isBusy = busy;
  loadBtn.disabled = busy;
  submitBtn.disabled = busy;
  notesList.querySelectorAll(".delete-btn").forEach(function (button) {
    button.disabled = busy;
  });
}

// Reusable request function: calls fetch, checks response.ok, throws on errors
async function request(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return { data: data, status: response.status };
}

// ---------- API functions ----------

// GET: load 10 notes
function getNotes() {
  return request(`${API_URL}?_limit=10`);
}

// POST: create a note
function createNote(note) {
  return request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(note),
  });
}

// DELETE: remove a note
function removeNote(id) {
  return request(`${API_URL}/${id}`, { method: "DELETE" });
}

// ---------- Rendering (user text is inserted with textContent only) ----------

function render() {
  notesList.replaceChildren();

  // Empty state
  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty-message");
    empty.textContent = "There are no notes to show.";
    notesList.append(empty);
    return;
  }

  notes.forEach(function (note) {
    const item = document.createElement("li");
    item.classList.add("note-card");

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = isBusy;
    deleteBtn.addEventListener("click", function () {
      handleDelete(note);
    });

    item.append(title, body, deleteBtn);
    notesList.append(item);
  });
}

// ---------- Event handlers ----------

// Task 1: GET
async function handleLoad() {
  setBusy(true);
  setStatus("Loading notes...", "loading");

  try {
    const { data } = await getNotes();
    notes = data;
    render();

    if (notes.length === 0) {
      setStatus("The server returned no notes.", "success");
    } else {
      const noun = notes.length === 1 ? "note" : "notes";
      setStatus(`Loaded ${notes.length} ${noun} from the server.`, "success");
    }
  } catch (error) {
    console.error(error);
    setStatus(
      "Sorry, we could not load your notes. Please check your connection and try again.",
      "error"
    );
  } finally {
    setBusy(false);
  }
}

// Task 2: POST (with validation)
async function handleSubmit(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    setStatus("A title is required.", "error");
    return;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    setStatus("The title must be 100 characters or fewer.", "error");
    return;
  }

  setBusy(true);
  setStatus("Creating note...", "loading");

  try {
    const { data, status } = await createNote({ title, body, userId: 1 });
    notes.unshift(data); // newest note goes to the top
    render();
    noteForm.reset();
    setStatus(`Note created (status ${status}, id ${data.id}).`, "success");
  } catch (error) {
    console.error(error);
    setStatus("Sorry, we could not create your note. Please try again.", "error");
  } finally {
    setBusy(false);
  }
}

// Task 3: DELETE
//
// JSONPlaceholder is a practice API: it ACCEPTS writes but does not store them.
// A POST returns a fake id (always 101) and a DELETE returns 200, but the
// server's data never changes. So I treat the notes array on the page as the
// source of truth: when the server answers OK, I remove that note from the
// array and the screen. Clicking "Load notes" again shows the original 10
// notes, because nothing was really deleted on the server. A real API would
// return 404 for a note that does not exist, and the catch block below would
// show that error. Notes are removed by object (not by id) because every note
// created here gets the same fake id.
async function handleDelete(note) {
  setBusy(true);
  setStatus("Deleting note...", "loading");

  try {
    const { status } = await removeNote(note.id);
    notes = notes.filter(function (item) {
      return item !== note;
    });
    render();
    setStatus(`Note deleted (status ${status}).`, "success");
  } catch (error) {
    console.error(error);
    setStatus("Sorry, we could not delete that note. Please try again.", "error");
  } finally {
    setBusy(false);
  }
}

loadBtn.addEventListener("click", handleLoad);
noteForm.addEventListener("submit", handleSubmit);