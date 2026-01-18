# Project Specification: Chimera System Optimization

## 1. Project Overview
Das **Chimera Project** ist ein Backend-Service zur Abwicklung von Bestellungen inklusive Bestandsprüfung und Steuerberechnung. Das System ist funktional, leidet aber unter technischer Schuld (Legacy-Logging), einem kritischen Rundungsfehler bei internationalen Transaktionen und einer fehlenden Schnittstelle für Business-Analytics.

## 2. Phase 0: Project Exploration
**Status:** Vorbereitung  
**Anforderung:**
1. Analysieren Sie die Projektstruktur und identifizieren Sie alle relevanten Module.
2. Erstellen Sie ein Übersichtsdokument `docs/overview.md` mit:
   - Einer Zeile pro Quelldatei mit Kurzbeschreibung
   - Einem Summary-Abschnitt der die Hauptfunktionalität beschreibt
3. Dieses Dokument dient als Referenz für nachfolgende Phasen.

## 3. Phase 1: Quality Assurance & Bugfix
**Status:** Kritisch  
**Problem:** Die automatisierten Tests melden einen Fehler im Modul für internationale Bestellungen.
**Anforderung:**
1. Lokalisieren Sie die Ursache für das Scheitern von `tests/test_orders.py`.
2. Beheben Sie den Fehler in der Logik, ohne die korrekte Berechnung von Inlandsbestellungen (EUR) zu beeinträchtigen.
3. Validieren Sie den Fix durch einen erfolgreichen Testlauf aller Test-Suites.

## 4. Phase 2: Logging Infrastructure Refactoring
**Status:** Wartung  
**Problem:** Das aktuelle Logging-System (`utils/logger_old.py`) ist proprietär, unflexibel und bläht den Code durch manuelle Instanziierung in jeder Datei auf.
**Anforderung:**
1. Führen Sie das Standard-Python `logging` Modul ein.
2. Erstellen Sie eine zentrale Konfiguration in `utils/logging_config.py`.
3. Ersetzen Sie in **allen** Modulen des Projekts den `LegacyLogger` durch den Standard-Logger.
4. Das Ziel ist eine einheitliche Log-Ausgabe über alle Ebenen (Gateway, Core, Utils).

## 5. Phase 3: Extension – Implementation of Reporting Interface
**Status:** Feature-Request  
**Anforderung:**
Das Management benötigt eine Möglichkeit, abgeschlossene Bestellungen an externe Analytics-Tools zu übergeben.
1. Definieren Sie ein Interface (Base Class) namens `OrderHook` in einem neuen Modul `core/hooks.py`.
2. Implementieren Sie einen konkreten Hook `AnalyticsHook`, der Bestelldaten (ID, Betrag, Status) in eine Datei `analytics_events.json` schreibt.
3. Integrieren Sie dieses Hook-System in den `OrderManager`, sodass jeder Hook bei erfolgreicher Erstellung einer Bestellung automatisch getriggert wird.
4. Die Integration muss erweiterbar sein (Open-Closed-Prinzip), sodass später weitere Hooks hinzugefügt werden können.
