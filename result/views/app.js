/* Lógica del navegador: escucha los resultados que emite el servidor. */
(function () {
  var socket = io();

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  socket.on("labels", function (labels) {
    setText("label-a", labels.a);
    setText("label-b", labels.b);
    setText("title", labels.a + " vs " + labels.b + " — Resultados");
  });

  socket.on("scores", function (data) {
    var percent = data.percent || { a: 0, b: 0 };
    var counts = data.counts || { a: 0, b: 0 };

    setText("stat-a", percent.a.toFixed(1) + "%");
    setText("stat-b", percent.b.toFixed(1) + "%");
    setText("votes-a", counts.a + (counts.a === 1 ? " voto" : " votos"));
    setText("votes-b", counts.b + (counts.b === 1 ? " voto" : " votos"));

    var total = data.total || 0;
    setText(
      "total",
      total === 0
        ? "Todavía no hay votos"
        : total === 1
        ? "1 voto"
        : total + " votos"
    );
  });

  socket.on("connect", function () {
    setText("connection", "● Conectado en tiempo real");
  });

  socket.on("disconnect", function () {
    setText("connection", "○ Desconectado — reintentando…");
  });
})();
