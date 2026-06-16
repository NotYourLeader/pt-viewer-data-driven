/* ============================================================
   schedule.js  —  Schedule renderer
   Reads data.json and builds every panel in the page.
   You should not need to edit this file to change the schedule:
   edit data.json instead. This file only defines HOW the data
   is drawn, never WHAT the data is.
   ============================================================ */

(function () {
  "use strict";

  // Fixed column layout for every timeline day card.
  // P6 is the lunch period and is rendered as a blocked column.
  var GRID = ["P1", "P2", "P3", "BREAK", "P4", "P5", "LUNCH", "P7", "P8", "P9", "P10"];
  var PERIOD_COLS = ["P1", "P2", "P3", "P4", "P5", "P7", "P8", "P9", "P10"]; // real teaching periods

  function pnum(p) { return parseInt(String(p).replace(/[^0-9]/g, ""), 10); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  /* ---------- HEADER + SUMMARY ---------- */

  function renderHeader(data) {
    document.title = data.meta.title || "Schedule";
    var h = document.getElementById("app-header");
    h.innerHTML =
      '<h1>' + esc(data.meta.title) + '</h1>' +
      '<p>' + esc(data.meta.subtitle) + '</p>';
  }

  function renderSummary(data) {
    var s = data.summary || {};
    var metrics = (s.metrics || []).map(function (m) {
      return '<div class="metric"><b>' + esc(m.value) + '</b><span>' + esc(m.label) + '</span></div>';
    }).join("");
    var notes = (s.notes || []).map(function (n) {
      // notes keep their original inline html (bold spans etc.) — already trusted local content
      return '<div class="' + esc(n.cls) + '">' + n.html + '</div>';
    }).join("");
    return '<section class="panel collapsible-panel summary-panel">' +
      '<details class="collapsible-details summary-details">' +
      '<summary class="collapsible-summary"><h2>Summary</h2>' +
      '<span class="summary-hint">Collapsed by default</span></summary>' +
      '<div class="collapsible-body"><div class="metrics">' + metrics + '</div>' +
      notes + '</div></details></section>';
  }

  /* ---------- STATIC SECTIONS (rarely change) ---------- */

  function renderStatic(html) { return html || ""; }

  /* ---------- LEADERSHIP TABLE ---------- */

  function renderLeadership(data) {
    var L = data.leadership || { headers: [], rows: [] };
    var thead = "<tr>" + L.headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>";
    var tbody = L.rows.map(function (r) {
      return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<section class="panel leadership-panel"><h2>Period leadership assignments</h2>' +
      '<div class="filter-bar">' +
      '<input id="ld-search" type="text" placeholder="Search leader, session, date…" />' +
      '<button id="ld-reset" type="button">Reset</button>' +
      '<span id="ld-count" class="filter-count"></span></div>' +
      '<div class="tablewrap"><table id="leadership-table"><thead>' + thead +
      '</thead><tbody>' + tbody + '</tbody></table></div></section>';
  }

  /* ---------- TIMELINE (the staff × period grid) ---------- */

  // Build one chip's HTML for a session in a given period column.
  function chipHtml(sess, isContinuation) {
    var typeClass = sess.type || "same";
    var classes = ["span-chip", typeClass, "staff-mini-block"];
    if (sess.flag) classes.push("has-flag");
    if (isContinuation) classes.push("staff-continuation");

    var span = (sess.endPeriod - sess.startPeriod + 1);
    // count only real periods in the span (skip lunch P6)
    var realSpan = 0;
    for (var p = sess.startPeriod; p <= sess.endPeriod; p++) { if (p !== 6) realSpan++; }
    var spanLabel = realSpan + "P";

    var codeLabel = (isContinuation ? "&#8623; " : "") + esc(sess.code);
    var title = sess.flag && sess.flag.note ? ' title="' + esc(sess.flag.note) + '"' : "";

    // period-room small text
    var rangeLabel;
    if (sess.startPeriod === sess.endPeriod) {
      rangeLabel = "P" + sess.startPeriod;
    } else {
      rangeLabel = "P" + sess.startPeriod + "&#8211;P" + sess.endPeriod;
    }
    var roomLabel = rangeLabel + (sess.room ? " &middot; " + esc(sess.room) : "");

    var topInner =
      '<div class="span-chip-top"' + title + '>' +
      '<b' + (sess.cancelled ? ' class="cancelled-pt"' : "") + ">" + codeLabel + "</b>" +
      "<span>" + spanLabel + "</span>" +
      (sess.flag ? '<span class="flag-badge ' + esc(sess.flag.type) + '"' + title + ">" + esc(sess.flag.text) + "</span>" : "") +
      "</div>";

    var teacherLine = '<small class="session-teacher">' + esc(sess.teacher) + "</small>";
    var roomLine = "<small>" + roomLabel + "</small>";
    var noteLine = sess.flag && sess.flag.note
      ? '<span class="flag-note ' + esc(sess.flag.type) + '"' + title + ">" + esc(sess.flag.note) + "</span>"
      : "";

    return '<div class="' + classes.join(" ") + '">' + topInner + teacherLine + roomLine + noteLine + "</div>";
  }

  function renderDayCard(date, daySessions, leaders, altClass) {
    // group sessions by the staff row they appear in (rowStaff overrides teacher)
    var rowsMap = {};
    var rowOrder = [];
    daySessions.forEach(function (s) {
      var rowName = s.rowStaff || s.teacher;
      if (!rowsMap[rowName]) { rowsMap[rowName] = []; rowOrder.push(rowName); }
      rowsMap[rowName].push(s);
    });

    // header row
    var headCells = '<th class="staff-head">Staff</th>';
    GRID.forEach(function (col) {
      if (col === "BREAK") { headCells += '<th class="break-head">Break</th>'; return; }
      if (col === "LUNCH") { headCells += '<th class="lunch-head">P6<br/><small>Lunch</small></th>'; return; }
      var ld = "";
      if (leaders) {
        var match = leaders.filter(function (x) { return x.period === col; })[0];
        if (match) ld = '<span class="period-leaders">' + esc(match.text) + "</span>";
      }
      headCells += "<th>" + col + ld + "</th>";
    });

    // body rows
    var bodyRows = rowOrder.map(function (rowName) {
      var sessions = rowsMap[rowName];
      var cells = '<th class="staff-row-name">' + esc(rowName) + "</th>";
      GRID.forEach(function (col) {
        if (col === "BREAK") { cells += '<td class="break-gap staff-break-gap"></td>'; return; }
        if (col === "LUNCH") { cells += '<td class="lunch-gap staff-lunch-gap"></td>'; return; }
        var pn = pnum(col);
        // find sessions covering this period in this row
        var here = sessions.filter(function (s) { return pn >= s.startPeriod && pn <= s.endPeriod; });
        if (!here.length) { cells += '<td class="staff-period-cell"></td>'; return; }
        var inner = here.map(function (s) {
          var isCont = pn > s.startPeriod;
          return chipHtml(s, isCont);
        }).join("");
        cells += '<td class="staff-period-cell staff-busy">' + inner + "</td>";
      });
      return '<tr class="staff-row day-alt-' + altClass + '">' + cells + "</tr>";
    }).join("");

    var sessionCount = daySessions.length;
    var countLabel = sessionCount
      ? sessionCount + (sessionCount === 1 ? " session" : " sessions")
      : "no sessions";
    return '<details class="day-timeline-card day-alt-' + altClass + '" data-date="' + esc(date) + '">' +
      '<summary class="day-card-summary"><h3>' + esc(date) + "</h3>" +
      '<span class="day-card-count">' + countLabel + "</span></summary>" +
      '<div class="day-card-body">' +
      '<table class="span-timeline day-timeline-table staff-row-table">' +
      '<colgroup><col class="staff-name-col"/><col/><col/><col/><col class="break-col"/>' +
      '<col/><col/><col class="lunch-col"/><col/><col/><col/><col/></colgroup>' +
      "<thead><tr>" + headCells + "</tr></thead><tbody>" + bodyRows + "</tbody></table></div></details>";
  }

  function renderTimeline(data) {
    var byDate = {};
    data.sessions.forEach(function (s) { (byDate[s.date] = byDate[s.date] || []).push(s); });

    var cards = data.dayOrder.map(function (date) {
      var meta = (data.dayMeta && data.dayMeta[date]) || { alt: "a" };
      var leaders = (data.periodLeaders && data.periodLeaders[date]) || [];
      var daySessions = (byDate[date] || []).slice().sort(function (a, b) {
        return a.startPeriod - b.startPeriod;
      });
      return renderDayCard(date, daySessions, leaders, meta.alt || "a");
    }).join("");

    return '<section class="panel timeline-span-panel"><h2>Timeline</h2>' +
      '<p class="timeline-help">Days are separated into daily cards. Within each day, the Y-axis shows ' +
      'session-supervising staff; period header leaders are the mobile leaders for that time.</p>' +
      '<div class="span-legend">' +
      '<span class="legend-item"><b>Block width</b> = test duration</span>' +
      '<span class="legend-item"><b>Stacked blocks</b> = concurrent sessions</span>' +
      '<span class="legend-item">P6 = lunch, blocked</span></div>' +
      '<div class="day-timeline-list">' + cards + "</div></section>";
  }

  /* ---------- FULL SCHEDULE TABLE ---------- */

  function renderFullSchedule(data) {
    var F = data.fullSchedule || { headers: [], rows: [] };
    var thead = "<tr>" + F.headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>";
    var tbody = F.rows.map(function (r) {
      // cells keep original rich html (chips, bold, small) — trusted local content
      return '<tr class="' + esc(r.rowClass) + '">' +
        r.cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<section class="panel"><h2>Full schedule</h2>' +
      '<div class="filter-bar">' +
      '<input id="fs-search" type="text" placeholder="Search any text…" />' +
      '<select id="fs-type"><option value="">All types</option>' +
      '<option value="testevent">Test</option>' +
      '<option value="relocateevent">Relocation</option></select>' +
      '<select id="fs-date"><option value="">All dates</option></select>' +
      '<button id="fs-reset" type="button">Reset</button>' +
      '<span id="fs-count" class="filter-count"></span></div>' +
      '<div class="tablewrap"><table id="full-sched-table"><thead>' + thead +
      "</thead><tbody>" + tbody + "</tbody></table></div></section>";
  }

  /* ---------- COVER / SUBSTITUTIONS TABLE ---------- */

  function renderCover(data) {
    var headers = ["Date", "Period", "Trigger session", "Type", "Affected class/group",
      "Normal lesson", "Normal teacher", "Cover / destination", "Instruction"];
    var thead = "<tr>" + headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>";
    var tbody = (data.cover || []).map(function (c) {
      return '<tr class="' + esc(c.rowClass) + '">' +
        "<td>" + esc(c.date) + "</td>" +
        "<td>" + esc(c.period) + "</td>" +
        "<td><b>" + esc(c.trigger) + "</b></td>" +
        '<td><span class="cover-type-pill">' + esc(c.type) + "</span></td>" +
        "<td>" + esc(c.affected) + "</td>" +
        "<td>" + esc(c.normalLesson) + "</td>" +
        "<td>" + esc(c.normalTeacher) + "</td>" +
        "<td>" + esc(c.destination) + "</td>" +
        "<td>" + esc(c.instruction) + "</td></tr>";
    }).join("");
    return '<section class="panel cover-panel"><h2>Cover / substitutions</h2>' +
      '<div class="filter-bar">' +
      '<input id="cv-search" type="text" placeholder="Search cover…" />' +
      '<button id="cv-reset" type="button">Reset</button>' +
      '<span id="cv-count" class="filter-count"></span></div>' +
      '<div class="tablewrap"><table id="cover-table"><thead>' + thead +
      "</thead><tbody>" + tbody + "</tbody></table></div></section>";
  }

  /* ---------- TEACHER & CLASS VIEWS (derived from sessions) ---------- */

  function uniqueSorted(arr) {
    var seen = {}; var out = [];
    arr.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  function renderTeacherView(data) {
    var teachers = uniqueSorted(data.sessions.map(function (s) { return s.teacher; }));
    var opts = teachers.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
    var views = teachers.map(function (t) {
      var rows = data.sessions.filter(function (s) { return s.teacher === t; })
        .sort(function (a, b) { return data.dayOrder.indexOf(a.date) - data.dayOrder.indexOf(b.date) || a.startPeriod - b.startPeriod; })
        .map(function (s) {
          var range = s.startPeriod === s.endPeriod ? "P" + s.startPeriod : "P" + s.startPeriod + "&#8211;P" + s.endPeriod;
          return "<tr><td>" + esc(s.date) + "</td><td>" + range + "</td><td><b>" + esc(s.code) +
            "</b></td><td>" + esc(s.room) + '</td><td><span class="badge ' + esc(s.type) + '">' + esc(s.type) + "</span></td></tr>";
        }).join("");
      return '<section class="teacher-view" data-teacher="' + esc(t) + '">' +
        "<h3>" + esc(t) + "</h3><div class='tablewrap'><table><thead><tr>" +
        "<th>Date</th><th>Period</th><th>Session</th><th>Room</th><th>Type</th></tr></thead><tbody>" +
        rows + "</tbody></table></div></section>";
    }).join("");
    return '<section class="panel"><h2>Teacher view / export</h2>' +
      '<div class="filter-bar"><select id="teacherSelect" onchange="showTeacher()">' + opts + "</select>" +
      '<button type="button" onclick="exportTeacher()">Export / print</button></div>' + views + "</section>";
  }

  function renderClassView(data) {
    var classes = uniqueSorted(data.sessions.map(function (s) { return s.code.split(".")[0]; }));
    var opts = classes.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
    var views = classes.map(function (c) {
      var rows = data.sessions.filter(function (s) { return s.code.split(".")[0] === c; })
        .sort(function (a, b) { return data.dayOrder.indexOf(a.date) - data.dayOrder.indexOf(b.date) || a.startPeriod - b.startPeriod; })
        .map(function (s) {
          var range = s.startPeriod === s.endPeriod ? "P" + s.startPeriod : "P" + s.startPeriod + "&#8211;P" + s.endPeriod;
          return '<tr class="testevent"><td>' + esc(s.date) + "</td><td>" + range + "</td><td><b>" + esc(s.code) +
            "</b></td><td>" + esc(s.teacher) + "</td><td>" + esc(s.room) + "</td></tr>";
        }).join("");
      return '<section class="class-view" data-class="' + esc(c) + '">' +
        "<h3>" + esc(c) + "</h3><div class='tablewrap'><table><thead><tr>" +
        "<th>Date</th><th>Period</th><th>Session</th><th>Teacher</th><th>Room</th></tr></thead><tbody>" +
        rows + "</tbody></table></div></section>";
    }).join("");
    return '<section class="panel"><h2>Class view / export</h2>' +
      '<div class="filter-bar"><select id="classSelect" onchange="showClass()">' + opts + "</select>" +
      '<button type="button" onclick="exportClass()">Export / print</button></div>' + views + "</section>";
  }

  /* ---------- FILTER WIRING (reused logic) ---------- */

  function ctxt(td) { return td ? (td.innerText || td.textContent || "") : ""; }
  function ptDate(s, year) {
    var mo = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    var m = (s || "").match(/(\d+)\s+(\w{3})/);
    return m ? new Date(year || 2026, mo[m[2]] || 0, +m[1]).getTime() : 0;
  }

  function wireTextFilter(tableId, searchId, resetId, countId, label) {
    var tbl = document.getElementById(tableId); if (!tbl) return;
    var s = document.getElementById(searchId), rs = document.getElementById(resetId), cnt = document.getElementById(countId);
    function run() {
      var q = (s.value || "").toLowerCase(), rows = tbl.querySelectorAll("tbody tr"), n = 0;
      rows.forEach(function (r) {
        var m = !q || (r.innerText || r.textContent || "").toLowerCase().indexOf(q) >= 0;
        r.style.display = m ? "" : "none"; if (m) n++;
      });
      if (cnt) cnt.textContent = n + " of " + rows.length + " " + label;
    }
    if (s) s.addEventListener("input", run);
    if (rs) rs.addEventListener("click", function () { s.value = ""; run(); });
    run();
  }

  function wireFullScheduleFilter(data) {
    var tbl = document.getElementById("full-sched-table"); if (!tbl) return;
    var s = document.getElementById("fs-search"), ty = document.getElementById("fs-type"),
      dt = document.getElementById("fs-date"), rs = document.getElementById("fs-reset"), cnt = document.getElementById("fs-count");
    var dates = {};
    tbl.querySelectorAll("tbody tr").forEach(function (r) { var d = ctxt(r.cells[2]).trim().split("\n")[0]; if (d) dates[d] = 1; });
    Object.keys(dates).forEach(function (d) { var o = document.createElement("option"); o.value = d; o.textContent = d; dt.appendChild(o); });
    function run() {
      var q = (s.value || "").toLowerCase(), tv = ty.value, dv = dt.value, rows = tbl.querySelectorAll("tbody tr"), n = 0;
      rows.forEach(function (r) {
        var mq = !q || (r.innerText || r.textContent || "").toLowerCase().indexOf(q) >= 0;
        var mt = !tv || r.classList.contains(tv);
        var md = !dv || ctxt(r.cells[2]).indexOf(dv) >= 0;
        r.style.display = (mq && mt && md) ? "" : "none"; if (mq && mt && md) n++;
      });
      cnt.textContent = n + " of " + rows.length + " sessions";
    }
    s.addEventListener("input", run); ty.addEventListener("change", run); dt.addEventListener("change", run);
    rs.addEventListener("click", function () { s.value = ""; ty.value = ""; dt.value = ""; run(); });
    run();
  }

  function sortTable(id, col, type, year) {
    var tbl = document.getElementById(id); if (!tbl) return;
    var ths = tbl.querySelectorAll("thead th"), th = ths[col]; if (!th) return;
    var asc = th.classList.contains("asc");
    ths.forEach(function (h) { h.classList.remove("asc", "desc"); });
    th.classList.add(asc ? "desc" : "asc");
    var tb = tbl.querySelector("tbody"), rows = [].slice.call(tb.querySelectorAll("tr"));
    rows.sort(function (a, b) {
      var av = ctxt(a.cells[col]).trim(), bv = ctxt(b.cells[col]).trim(), d = 0;
      if (type === "date") d = ptDate(av, year) - ptDate(bv, year);
      else if (type === "period") d = (pnum(av) || 0) - (pnum(bv) || 0);
      else if (type === "num") d = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
      else d = av.localeCompare(bv);
      return asc ? -d : d;
    });
    rows.forEach(function (r) { tb.appendChild(r); });
  }

  function makeSortable(id, types, year) {
    var tbl = document.getElementById(id); if (!tbl) return;
    tbl.querySelectorAll("thead th").forEach(function (th, i) {
      th.classList.add("sort-th");
      th.addEventListener("click", function () { sortTable(id, i, types[i] || "text", year); });
    });
  }

  /* view switchers (exposed globally for inline onchange/onclick) */
  window.showClass = function () {
    var val = document.getElementById("classSelect").value;
    document.querySelectorAll(".class-view").forEach(function (e) { e.classList.toggle("active", e.dataset.class === val); });
  };
  window.showTeacher = function () {
    var val = document.getElementById("teacherSelect").value;
    document.querySelectorAll(".teacher-view").forEach(function (e) { e.classList.toggle("active", e.dataset.teacher === val); });
  };
  window.exportTeacher = function () {
    var val = document.getElementById("teacherSelect").value;
    var node = document.querySelector('.teacher-view[data-teacher="' + (window.CSS ? CSS.escape(val) : val) + '"]');
    if (!node) return;
    var w = window.open("", "_blank");
    var base = document.querySelector("style") ? document.querySelector("style").outerHTML : "";
    w.document.write("<html><head><title>" + val + "</title>" + base + "</head><body style='padding:20px'>" + node.outerHTML + "</body></html>");
    w.document.close(); w.print();
  };
  window.exportClass = function () {
    var val = document.getElementById("classSelect").value;
    var node = document.querySelector('.class-view[data-class="' + (window.CSS ? CSS.escape(val) : val) + '"]');
    if (!node) return;
    var w = window.open("", "_blank");
    var base = document.querySelector("style") ? document.querySelector("style").outerHTML : "";
    w.document.write("<html><head><title>" + val + "</title>" + base + "</head><body style='padding:20px'>" + node.outerHTML + "</body></html>");
    w.document.close(); w.print();
  };

  /* ---------- MAIN ---------- */

  /* ---------- COLLAPSE PAST DAYS, LAND ON NEXT TESTING DAY ---------- */

  // A "testing day" is any day card that has at least one session.
  // Past days (before today) are collapsed; today and future days stay open.
  // The page then scrolls so the next testing day (today or the soonest future
  // day with sessions) sits at the top of the view.
  function focusNextTestingDay(data) {
    var year = (data.meta && data.meta.year) || 2026;
    var todayMs = new Date().setHours(0, 0, 0, 0);

    var cards = [].slice.call(document.querySelectorAll(".day-timeline-card[data-date]"));
    if (!cards.length) return;

    var nextCard = null;
    cards.forEach(function (card) {
      var dateStr = card.getAttribute("data-date");
      var dayMs = ptDate(dateStr, year);
      var isPast = dayMs && dayMs < todayMs;
      var hasSessions = card.querySelector(".staff-row") != null;

      // collapse past days; keep today and future open
      card.open = !isPast;

      // the next testing day = earliest day that is today-or-later AND has sessions
      if (!isPast && hasSessions && !nextCard) nextCard = card;
    });

    // if every day is in the past (e.g. viewing an old schedule), fall back to
    // the last day that actually has sessions so the user still lands somewhere useful
    if (!nextCard) {
      for (var i = cards.length - 1; i >= 0; i--) {
        if (cards[i].querySelector(".staff-row")) { nextCard = cards[i]; nextCard.open = true; break; }
      }
    }

    if (nextCard) {
      nextCard.classList.add("day-card-next");
      // defer scroll until layout settles
      requestAnimationFrame(function () {
        nextCard.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }
  }

  function build(data) {
    renderHeader(data);
    var main = document.getElementById("app-main");
    var year = (data.meta && data.meta.year) || 2026;

    main.innerHTML = [
      renderSummary(data),
      renderStatic(data.staticSections && data.staticSections.adjustments),
      renderStatic(data.staticSections && data.staticSections.shadow),
      renderStatic(data.staticSections && data.staticSections.constraints),
      renderLeadership(data),
      renderTimeline(data),
      renderTeacherView(data),
      renderClassView(data),
      renderFullSchedule(data),
      renderCover(data)
    ].join("");

    // wire interactivity
    makeSortable("leadership-table", ["date", "period", "text", "text", "num"], year);
    makeSortable("full-sched-table", ["text", "text", "date", "period", "text", "text", "text", "text", "text"], year);
    makeSortable("cover-table", ["date", "period", "text", "text", "text", "text", "text", "text", "text"], year);
    wireTextFilter("leadership-table", "ld-search", "ld-reset", "ld-count", "entries");
    wireTextFilter("cover-table", "cv-search", "cv-reset", "cv-count", "rows");
    wireFullScheduleFilter(data);

    // initialise first teacher/class view
    var ts = document.getElementById("teacherSelect"); if (ts && ts.options.length) window.showTeacher();
    var cs = document.getElementById("classSelect"); if (cs && cs.options.length) window.showClass();

    // collapse past days and scroll to the next testing day
    focusNextTestingDay(data);
  }

  function showError(msg) {
    var main = document.getElementById("app-main");
    main.innerHTML = '<div class="load-error"><b>Could not load schedule data.</b><br/>' + esc(msg) +
      '<br/><br/>If you opened this file directly from disk, your browser blocks <code>data.json</code>. ' +
      'Serve the folder over HTTP (e.g. GitHub Pages, or <code>python3 -m http.server</code>) and reload.</div>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetch("data.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(build)
      .catch(function (e) { showError(e.message || String(e)); });
  });
})();
