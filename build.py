import re, json, os, shutil, zipfile

three = open('vendor/three.min.js').read()
main = open('src/main.js').read()
tpl = open('src/template.html').read()


def page(defaults, preview=False):
    s = tpl.replace('/*THREE*/', three).replace('/*MAIN*/', main)
    s = re.sub(r'/\*DEFAULTS\*/.*?/\*END\*/', lambda m: json.dumps(defaults, ensure_ascii=False), s, flags=re.S)
    s = re.sub(r'/\*PREVIEW\*/.*?/\*END\*/', lambda m: 'true' if preview else 'false', s, flags=re.S)
    return s


os.makedirs('dist/avulsos', exist_ok=True)
open('dist/avulsos/tela1.html', 'w').write(page({"tela": 0}))
open('dist/avulsos/tela2.html', 'w').write(page({"tela": 1, "painel": False, "gistId": ""}))
open('dist/preview.html', 'w').write(page({"tela": 2, "painel": False}, preview=True))

# ---------- pacote do Lively ----------
pk = 'dist/LagoPontilhado'
shutil.rmtree(pk, ignore_errors=True)
os.makedirs(pk)
open(f'{pk}/index.html', 'w').write(page({"tela": 0}))
info = {
    "AppVersion": "2.1.0.0",
    "Title": "Lago Pontilhado",
    "Thumbnail": "thumbnail.jpg",
    "Preview": None,
    "Desc": "Lago em dithering que acompanha a hora, o clima, o pôr do sol e a lua de Vila Velha. Use \"Personalizar\" para escolher a parte da cena e ligar o painel.",
    "Author": "Rodrigo",
    "License": None,
    "Contact": None,
    "Type": 2,
    "FileName": "index.html",
    "Arguments": "--system-nowplaying --pause-event true",
    "IsAbsolutePath": False,
    "Id": None,
    "Tags": ["lago", "pixel", "dither", "relogio"],
    "Version": 1,
}
json.dump(info, open(f'{pk}/LivelyInfo.json', 'w'), ensure_ascii=False, indent=2)
props = {
    "tela": {"type": "dropdown", "text": "Parte da cena neste monitor", "value": 0,
             "items": ["Esquerda (barco)", "Direita (píer)", "Cena inteira"]},
    "painel": {"type": "checkbox", "text": "Mostrar painel (relógio, clima, agenda, lembretes, música)", "value": False},
    "cantoPainel": {"type": "dropdown", "text": "Canto do painel", "value": 0,
                    "items": ["Superior esquerdo", "Superior direito", "Inferior esquerdo", "Inferior direito"]},
    "mostrarRelogio": {"type": "checkbox", "text": "Painel: relógio e data", "value": True},
    "mostrarClima": {"type": "checkbox", "text": "Painel: clima", "value": True},
    "mostrarMusica": {"type": "checkbox", "text": "Painel: música tocando", "value": True},
    "gistId": {"type": "textbox", "text": "ID ou link do Gist dos lembretes", "value": ""},
    "cachorro": {"type": "checkbox", "text": "Cadeira e o Loki no píer", "value": True},
    "bichos": {"type": "checkbox", "text": "Bichos no lago (peixes, libélulas, borboletas)", "value": True},
    "datas": {"type": "checkbox", "text": "Datas especiais (Natal, Ano Novo, aniversário, Halloween, Festa Junina)", "value": True},
    "aniversario": {"type": "textbox", "text": "Seu aniversário (dia/mês)", "value": "06/04"},
    "gaivotas": {"type": "checkbox", "text": "Gaivotas voando de vez em quando", "value": False},
    "climaReal": {"type": "checkbox", "text": "Clima real de Vila Velha (chuva, nuvens, vento)", "value": True},
    "musicaAgua": {"type": "checkbox", "text": "Água reage à música", "value": True},
    "pixel": {"type": "dropdown", "text": "Tamanho do pixel", "value": 0, "items": ["Pequeno (1 px)", "Médio (2 px, mais leve)", "Grande (3 px, bem leve)"]},
    "fps": {"type": "slider", "text": "Quadros por segundo (30 já fica liso; 60 usa o dobro da placa)", "min": 15, "max": 60, "step": 5, "value": 30},
}
json.dump(props, open(f'{pk}/LivelyProperties.json', 'w'), ensure_ascii=False, indent=2)
if os.path.exists('src/thumbnail.jpg'):
    shutil.copy('src/thumbnail.jpg', f'{pk}/thumbnail.jpg')
zp = 'dist/Lago Pontilhado (Lively).zip'
if os.path.exists(zp):
    os.remove(zp)
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(pk)):
        z.write(os.path.join(pk, f), f)
print('ok', os.path.getsize(zp))
