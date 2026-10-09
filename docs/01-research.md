# 01 — Idea & Research

**Sprint:** Sprint ??? — job-kit
**PIC:** imelda
**Builder:** imelda
**Date:** 2026-10-09
**P1 verdict:** BUILD

> Catatan asal: file ini ditulis minimal dari `docs/prd.md` (draft eksplorasi, 2026-09-02), **bukan** hasil P1 penuh. Tidak ada riset pengguna nyata di bawah ini. Gate dilewati atas keputusan PIC.

## 1. Ide (satu kalimat)

Chrome extension yang mengisi form lamaran kerja dari satu profil lokal, dengan satu klik dan bisa di-undo.

## 2. Masalah

Pelamar mengetik data yang sama berulang di banyak form lamaran. Autofill bawaan browser tidak mengenal field lamaran seperti "tahun lulus", "IPK", "ekspektasi gaji", atau "notice period".

## 3. Evidence

UNKNOWN — no real research yet. Klaim "20–60 form per bulan" di PRD lama adalah asumsi PIC, bukan data.

## 4. Alternatif yang ada

- Autofill bawaan Chrome: hanya field standar.
- Simplify Copilot: kompetitor langsung; fitur lebih banyak, identitas visual tidak ditiru.

## 5. Verdict

**BUILD.** Dipangkas ke core flow: Profil → Fill → Undo. Sisanya ditunda (lihat `docs/02-prd.md` §9).
