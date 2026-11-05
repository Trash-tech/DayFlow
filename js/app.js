// Dayflow — календарь и напоминания

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "nedelya-planner-v1";
const THEME_KEY = "nedelya-theme";

let data = {
  notes: [],
  dailyTasks: [],
  reminders: []
};

let viewDate = new Date();
let editingId = null;

// Загружаем сохранённые данные.
try {
  const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  data = { ...data, ...savedData };

  if (!Array.isArray(data.reminders)) data.reminders = [];
  if (!Array.isArray(data.dailyTasks)) data.dailyTasks = [];
  if (!Array.isArray(data.notes)) data.notes = [];
} catch (error) {
  console.warn("Не удалось прочитать сохранённые данные:", error);
}

// Сохраняем данные в браузере.
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function getDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function isSameDay(firstDate, secondDate) {
  return getDateKey(firstDate) === getDateKey(secondDate);
}

function getEventBackground(color) {
  return `color-mix(in srgb, ${color} 15%, transparent)`;
}

// Отрисовываем выбранный месяц.
function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;

  const calendarStart = new Date(year, month, 1 - offset);
  const today = new Date();

  $("monthTitle").textContent = viewDate.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric"
  });

  $("todayLabel").textContent = `Сегодня · ${today.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long"
  })}`;

  const grid = $("monthGrid");
  grid.innerHTML = "";

  // В сетке всегда шесть календарных недель.
  for (let index = 0; index < 42; index++) {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    const dateKey = getDateKey(date);
    const dayEvents = data.reminders
      .filter((reminder) => reminder.date === dateKey)
      .sort((first, second) => (first.time || "").localeCompare(second.time || ""));

    const cell = document.createElement("div");
    cell.className = "day-cell";

    if (date.getMonth() !== month) {
      cell.classList.add("outside");
    }

    if (isSameDay(date, today)) {
      cell.classList.add("today");
    }

    const visibleEvents = dayEvents.slice(0, 3);

    const eventsHtml = visibleEvents.map((reminder) => {
      const color = reminder.color || "#8b7cf6";
      const time = reminder.time ? `${escapeHtml(reminder.time)} ` : "";

      return `
        <div
          class="event"
          data-event-id="${escapeHtml(reminder.id)}"
          style="background: ${getEventBackground(color)}; color: ${color}"
        >
          <span class="event-color" style="background: ${color}"></span>
          <span class="event-title">${time}${escapeHtml(reminder.title)}</span>
        </div>
      `;
    }).join("");

    const moreHtml = dayEvents.length > 3
      ? `<div class="more-events">ещё ${dayEvents.length - 3}…</div>`
      : "";

    cell.innerHTML = `
      <div class="day-top">
        <span class="day-number">${date.getDate()}</span>
        <button
          class="add-mini"
          data-add-date="${dateKey}"
          title="Добавить напоминание"
          aria-label="Добавить напоминание"
        >＋</button>
      </div>
      <div class="event-list">${eventsHtml}${moreHtml}</div>
    `;

    cell.addEventListener("click", () => {
      openDayModal(dateKey);
    });

    cell.querySelector("[data-add-date]").addEventListener("click", (event) => {
      event.stopPropagation();
      openReminderModal(dateKey);
    });

    grid.appendChild(cell);
  }
}

// Показываем все напоминания выбранного дня в отдельном окне поверх календаря.
function openDayModal(date) {
  const selectedDate = parseDate(date);
  const dayReminders = data.reminders
    .filter((reminder) => reminder.date === date)
    .sort((first, second) => (first.time || "").localeCompare(second.time || ""));

  $("dayModalTitle").textContent = selectedDate.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  $("dayModalSub").textContent = `${dayReminders.length} ${
    dayReminders.length === 1 ? "напоминание" : "напоминаний"
  }`;

  const list = $("dayModalList");

  if (dayReminders.length === 0) {
    list.innerHTML = '<div class="day-empty">На этот день пока ничего не запланировано.</div>';
  } else {
    list.innerHTML = dayReminders.map((reminder) => {
      const color = reminder.color || "#8b7cf6";

      return `
        <button class="day-reminder" type="button" data-day-reminder-id="${escapeHtml(reminder.id)}">
          <span class="day-reminder-color" style="background:${color}"></span>
          <span class="day-reminder-info">
            <span class="day-reminder-name">${escapeHtml(reminder.title)}</span>
            <span class="day-reminder-time">${reminder.time ? escapeHtml(reminder.time) : "Время не указано"}</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      `;
    }).join("");
  }

  $("dayModalAdd").dataset.date = date;
  $("dayModalBackdrop").classList.add("open");
}

// Закрываем окно выбранного дня.
function closeDayModal() {
  $("dayModalBackdrop").classList.remove("open");
}

// Открываем форму создания или редактирования напоминания.
function openReminderModal(date = getDateKey(new Date()), reminderId = null) {
  editingId = reminderId;

  const reminder = reminderId
    ? data.reminders.find((item) => item.id === reminderId)
    : null;

  $("reminderForm").reset();
  $("reminderDate").value = reminder ? reminder.date : date;
  $("reminderName").value = reminder ? reminder.title : "";
  $("reminderTime").value = reminder ? reminder.time || "" : "";
  $("reminderColor").value = reminder ? reminder.color || "#8b7cf6" : "#8b7cf6";

  $("modalTitle").textContent = reminder
    ? "Изменить напоминание"
    : "Новое напоминание";

  $("modalSub").textContent = parseDate(reminder ? reminder.date : date)
    .toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  $("saveReminder").textContent = reminder ? "Сохранить" : "Добавить";

  // Кнопка удаления показывается только при редактировании.
  removeDeleteButton();

  if (reminder) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "cancel-btn";
    deleteButton.id = "deleteReminder";
    deleteButton.textContent = "Удалить";

    $("saveReminder").before(deleteButton);

    deleteButton.addEventListener("click", () => {
      data.reminders = data.reminders.filter((item) => item.id !== reminderId);
      saveData();
      closeReminderModal();
      renderCalendar();
    });
  }

  $("modalBackdrop").classList.add("open");
  $("reminderName").focus();
}

// Убираем кнопку удаления при закрытии или повторном открытии формы.
function removeDeleteButton() {
  const deleteButton = $("deleteReminder");

  if (deleteButton) {
    deleteButton.remove();
  }
}

// Закрываем форму напоминания.
function closeReminderModal() {
  $("modalBackdrop").classList.remove("open");
  editingId = null;
  removeDeleteButton();
}

// Добавляем или сохраняем напоминание.
function handleReminderSubmit(event) {
  event.preventDefault();

  const title = $("reminderName").value.trim();
  const date = $("reminderDate").value;

  if (!title || !date) {
    return;
  }

  const reminder = {
    id: editingId || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    title,
    date,
    time: $("reminderTime").value,
    color: $("reminderColor").value
  };

  if (editingId) {
    data.reminders = data.reminders.map((item) =>
      item.id === editingId ? reminder : item
    );
  } else {
    data.reminders.push(reminder);
  }

  saveData();
  closeReminderModal();

  // После сохранения показываем месяц выбранной даты.
  viewDate = parseDate(date);
  renderCalendar();
}

// Переключаем тему и запоминаем выбор.
function setTheme(isDark) {
  document.body.classList.toggle("dark", isDark);

  $("themeToggle").textContent = isDark
    ? "☀ Светлая тема"
    : "☾ Тёмная тема";

  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

// Обработчики интерфейса.
$("addReminder").addEventListener("click", () => {
  openReminderModal(getDateKey(new Date()));
});

$("closeModal").addEventListener("click", closeReminderModal);
$("cancelModal").addEventListener("click", closeReminderModal);

$("modalBackdrop").addEventListener("click", (event) => {
  if (event.target === $("modalBackdrop")) {
    closeReminderModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if ($("modalBackdrop").classList.contains("open")) {
      closeReminderModal();
    } else {
      closeDayModal();
    }
  }
});

$("closeDayModal").addEventListener("click", closeDayModal);

$("dayModalBackdrop").addEventListener("click", (event) => {
  if (event.target === $("dayModalBackdrop")) {
    closeDayModal();
  }
});

$("dayModalAdd").addEventListener("click", () => {
  const date = $("dayModalAdd").dataset.date;
  closeDayModal();
  openReminderModal(date);
});

$("dayModalList").addEventListener("click", (event) => {
  const reminderButton = event.target.closest("[data-day-reminder-id]");

  if (!reminderButton) {
    return;
  }

  const reminder = data.reminders.find(
    (item) => item.id === reminderButton.dataset.dayReminderId
  );

  if (reminder) {
    closeDayModal();
    openReminderModal(reminder.date, reminder.id);
  }
});

$("reminderForm").addEventListener("submit", handleReminderSubmit);

$("prevMonth").addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  renderCalendar();
});

$("nextMonth").addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  renderCalendar();
});

$("todayBtn").addEventListener("click", () => {
  viewDate = new Date();
  renderCalendar();
});

$("themeToggle").addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark");
  setTheme(!isDark);
});

// Переключаем страницы внутри Dayflow.
const views = {
  dashboard: "dashboardView",
  "daily-list": "dailyListView",
  notes: "notesView",
  settings: "settingsView"
};

function showView(name) {
  const pageTitles = {
    dashboard: "Дашборд",
    "daily-list": "Список на день",
    notes: "Заметки",
    settings: "Настройки"
  };

  $("pageTitle").textContent = pageTitles[name];

  Object.entries(views).forEach(([key, id]) => {
    $(id).classList.toggle("active", key === name);
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === name);
  });

  if (name === "daily-list") renderTasks();
  if (name === "notes") renderNotes();
}

document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

// Список на день.
function renderTasks() {
  const list = $("taskList");
  list.innerHTML = "";

  $("taskEmpty").hidden = data.dailyTasks.length > 0;
  data.dailyTasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = `task-row${task.done ? " done" : ""}`;
    row.innerHTML = `
      <button class="task-check" type="button"
        aria-label="Отметить выполненным"
        aria-pressed="${task.done}">
        <span></span>
      </button>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <button class="task-delete" type="button" aria-label="Удалить дело">×</button>
    `;

    row.querySelector(".task-check").addEventListener("click", () => {
      task.done = !task.done;
      saveData();
      renderTasks();
    });

    row.querySelector(".task-delete").addEventListener("click", () => {
      data.dailyTasks = data.dailyTasks.filter((item) => item.id !== task.id);
      saveData();
      renderTasks();
    });

    row.style.animation = "taskAppear .3s ease both";
    list.appendChild(row);
  });

  const doneCount = data.dailyTasks.filter((task) => task.done).length;
  $("taskFooter").textContent = data.dailyTasks.length
    ? `Выполнено: ${doneCount} из ${data.dailyTasks.length}`
    : "";
}

$("taskForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("taskInput");
  const text = input.value.trim();
  if (!text) return;

  data.dailyTasks.push({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    text,
    done: false
  });

  saveData();
  input.value = "";
  renderTasks();
  input.focus();
});

// Заметки без срока выполнения.
let activeNoteId = null;

function renderNotes() {
  const list = $("notesList");
  list.innerHTML = "";

  data.notes.forEach((note) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `note-card${note.id === activeNoteId ? " active" : ""}`;
    const preview = (note.body || "").trim().replace(/\s+/g, " ").slice(0, 90);

    card.innerHTML = `
      <strong>${escapeHtml(note.title || "Без названия")}</strong>
      <span>${new Date(note.updatedAt || Date.now()).toLocaleDateString("ru-RU")}</span>
      <div class="note-preview">${escapeHtml(preview || "Пустая заметка")}</div>
    `;

    card.addEventListener("click", () => openNote(note.id));
    list.appendChild(card);
  });

  if (!activeNoteId || !data.notes.some((note) => note.id === activeNoteId)) {
    $("noteForm").hidden = true;
    $("noteEditorEmpty").hidden = false;
  }
}

function openNote(noteId = null) {
  let note = data.notes.find((item) => item.id === noteId);

  if (!note) {
    note = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      title: "",
      body: "",
      updatedAt: Date.now()
    };
    data.notes.unshift(note);
    saveData();
  }

  activeNoteId = note.id;
  $("noteTitle").value = note.title;
  $("noteBody").value = note.body;
  $("noteEditorEmpty").hidden = true;
  $("noteForm").hidden = false;
  renderNotes();
  $("noteTitle").focus();
}

function createNote() {
  openNote();
}

$("newNoteBtn").addEventListener("click", createNote);
$("firstNoteBtn").addEventListener("click", createNote);

$("noteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const note = data.notes.find((item) => item.id === activeNoteId);
  if (!note) return;

  note.title = $("noteTitle").value.trim() || "Без названия";
  note.body = $("noteBody").value;
  note.updatedAt = Date.now();
  saveData();
  renderNotes();
});

$("deleteNoteBtn").addEventListener("click", () => {
  if (!activeNoteId) return;
  data.notes = data.notes.filter((note) => note.id !== activeNoteId);
  activeNoteId = null;
  saveData();
  renderNotes();
});

// Восстанавливаем тему и показываем календарь.
setTheme(localStorage.getItem(THEME_KEY) === "dark");
renderCalendar();
