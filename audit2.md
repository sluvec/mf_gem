
# Audit Instructions – *gem.html* (audit2)
> **Cel:** naprawić błędy krytyczne, oczyścić plik oraz przygotować grunt pod dalszy refaktor, **utrzymując jeden plik HTML**.

---

## 1&nbsp;&nbsp;Blokery uruchomieniowe — napraw w pierwszej kolejności

| # | Znalezisko | Co zrobić |
|---|------------|-----------|
| **1** | Brak funkcji `toggleDropdown` (wywoływana inline). | Zaimplementuj jedną globalnie dostępną funkcję → przypisz `window.toggleDropdown`. Powinna zamykać inne menu, aktualizować `aria-expanded` i chować się po kliknięciu poza menu. |
| **2** | `window.showPage is not a function` – powielone definicje. | Usuń duplikaty, zostaw **jedną** implementację i wykonaj `window.showPage = showPage`. |
| **3** | Błąd `Invalid value "${safeQty}"` w polu `<input type="number">`. | Do pól liczbowych przekazuj **czystą** liczbę `qty`; sanitizuj wyłącznie tekst/HTML. |
| **4** | Zdublowane klasy/funkcje (`ToastManager`, itp.). | Usuń wszystkie kopie oprócz jednej, sprawdź sekcje ~14 500+. |

---

## 2&nbsp;&nbsp;Redukcja duplikatów i chaosu globalnego

- **Skonsoliduj renderery list**  
  Wydziel helper `renderTable({data, columns, targetId})`, zamiast powtarzać `map().join("")` w kilku miejscach.

- **Jedno źródło sanitizacji**  
  Zostaw pojedynczy moduł z funkcjami `escapeHTML` / `sanitizeHTML`, usuń pozostałe kopie.

- **Migracja z `onclick` do `addEventListener`**  
  Zacznij od najpopularniejszych akcji (`toggleDropdown`, `removeLine`, `updateLineQty`). Ułatwi późniejszą minifikację i testy.

- **Enkapsulacja**  
  Owiń cały JS w IIFE z `'use strict'`, a publiczne API udostępnij przez `window.app = { ... }`.

---

## 3&nbsp;&nbsp;Stabilność i jakość (quick wins)

1. **ESLint & Prettier**  
   - Dodaj `/* eslint-env browser, es2023 */` na górze pliku.  
   - Uruchom `eslint --fix gem.html`, popraw wyróżnione problemy.

2. **Walidacja formularzy**  
   - Atrybuty `required`, `min`, `max` dla pól liczbowych.  
   - `pattern` dla SKU (np. `[A-Z0-9-]+`).

3. **Dostępność (A11y)**  
   - Aktualizuj `aria-expanded` w dropdownach.  
   - Dodaj `aria-label` do ikon przycisków („×”, Edit, Delete).

4. **Wydajność**  
   - Czyść słuchacze przy zmianie widoku (`removeEventListener` w `showPage`).  
   - Przy listach > 500 elementów renderuj partiami z `requestAnimationFrame`.

---

## 4&nbsp;&nbsp;Sekcja *build* (zachowując single‑file)

Umieść w komentarzu na końcu pliku:

```bash
# lint (dev)
eslint gem.html

# build (prod – minifikacja bez rozbijania na pliki)
terser gem.html --output gem.min.html --compress --mangle
```

---

## Check‑lista do odhaczenia

- [ ] `toggleDropdown` zaimplementowane i eksportowane.  
- [ ] Zostawiono jedną wersję `showPage`, `ToastManager`, `sanitizeHTML`.  
- [ ] Naprawiono błąd z `${safeQty}`.  
- [ ] Cały JS w IIFE + `'use strict'`; `window.app` exposes public API.  
- [ ] Pierwsza partia `onclick` migrowana na `addEventListener`.  
- [ ] `eslint --fix` przechodzi bez błędów.  
- [ ] Formularze walidują dane w HTML5.  
- [ ] Atrybuty A11y (`aria-*`) uzupełnione.  
- [ ] Instrukcja build (lint + terser) dodana w komentarzu.

> Po odhaczeniu wszystkich punktów konsola przeglądarki powinna być czysta, a aplikacja w pełni funkcjonalna.
