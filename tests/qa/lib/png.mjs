/**
 * png.mjs — lecteur PNG minimal, pour MESURER des pixels réellement rendus.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi ce fichier plutôt qu'une dépendance
 *
 * La sonde de contraste doit lire les pixels d'une capture d'écran. Le dépôt n'a
 * aucun décodeur d'image, et en ajouter un (pngjs, sharp, jimp) pour lire un
 * tableau d'octets serait une dépendance de plus dans une PWA destinée à des
 * connexions instables — même en devDependency, c'est de la surface à maintenir.
 * `node:zlib` fait déjà le seul morceau difficile : la décompression.
 *
 * Ce lecteur couvre EXACTEMENT ce que produit Playwright : PNG 8 bits par canal,
 * non entrelacé, en couleur vraie avec ou sans alpha. Il refuse bruyamment tout
 * le reste plutôt que de rendre des pixels approximatifs — une mesure fausse qui
 * annonce la réussite est pire que pas de mesure du tout.
 */

import { inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Reconstruit une ligne filtrée. Les cinq filtres de la spécification PNG. */
function defiltrer(type, ligne, precedente, octetsParPixel) {
  const sortie = Buffer.alloc(ligne.length)

  for (let i = 0; i < ligne.length; i += 1) {
    const brut = ligne[i]
    const a = i >= octetsParPixel ? sortie[i - octetsParPixel] : 0 // pixel de gauche
    const b = precedente ? precedente[i] : 0 // pixel du dessus
    const c = precedente && i >= octetsParPixel ? precedente[i - octetsParPixel] : 0 // diagonale

    switch (type) {
      case 0:
        sortie[i] = brut
        break
      case 1:
        sortie[i] = (brut + a) & 0xff
        break
      case 2:
        sortie[i] = (brut + b) & 0xff
        break
      case 3:
        sortie[i] = (brut + ((a + b) >> 1)) & 0xff
        break
      case 4: {
        // Paeth : on choisit le prédicteur le plus proche de a+b−c.
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        const predicteur = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        sortie[i] = (brut + predicteur) & 0xff
        break
      }
      default:
        throw new Error(`Filtre PNG inconnu : ${type}`)
    }
  }

  return sortie
}

/**
 * Décode un PNG en { largeur, hauteur, pixels } où `pixels` est un Buffer RGBA
 * de largeur × hauteur × 4 octets.
 */
export function lirePng(tampon) {
  if (!tampon.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Ce n'est pas un PNG : signature absente.")
  }

  let position = 8
  let entete = null
  const morceauxIdat = []

  while (position < tampon.length) {
    const longueur = tampon.readUInt32BE(position)
    const type = tampon.toString('ascii', position + 4, position + 8)
    const donnees = tampon.subarray(position + 8, position + 8 + longueur)

    if (type === 'IHDR') {
      entete = {
        largeur: donnees.readUInt32BE(0),
        hauteur: donnees.readUInt32BE(4),
        profondeur: donnees[8],
        typeCouleur: donnees[9],
        entrelacement: donnees[12],
      }
    } else if (type === 'IDAT') {
      morceauxIdat.push(donnees)
    } else if (type === 'IEND') {
      break
    }

    position += 12 + longueur // longueur + type + données + CRC
  }

  if (!entete) throw new Error('PNG sans en-tête IHDR.')

  // On refuse ce qu'on ne sait pas lire, plutôt que de rendre n'importe quoi.
  if (entete.profondeur !== 8) {
    throw new Error(`Profondeur ${entete.profondeur} non gérée (8 attendue).`)
  }
  if (entete.entrelacement !== 0) {
    throw new Error('PNG entrelacé non géré.')
  }
  if (entete.typeCouleur !== 2 && entete.typeCouleur !== 6) {
    throw new Error(`Type de couleur ${entete.typeCouleur} non géré (2 ou 6 attendus).`)
  }

  const canaux = entete.typeCouleur === 6 ? 4 : 3
  const brut = inflateSync(Buffer.concat(morceauxIdat))
  const octetsParLigne = entete.largeur * canaux
  const pixels = Buffer.alloc(entete.largeur * entete.hauteur * 4, 255)

  let curseur = 0
  let precedente = null

  for (let y = 0; y < entete.hauteur; y += 1) {
    const typeFiltre = brut[curseur]
    curseur += 1
    const ligne = brut.subarray(curseur, curseur + octetsParLigne)
    curseur += octetsParLigne

    const defiltree = defiltrer(typeFiltre, ligne, precedente, canaux)
    precedente = defiltree

    for (let x = 0; x < entete.largeur; x += 1) {
      const source = x * canaux
      const cible = (y * entete.largeur + x) * 4
      pixels[cible] = defiltree[source]
      pixels[cible + 1] = defiltree[source + 1]
      pixels[cible + 2] = defiltree[source + 2]
      pixels[cible + 3] = canaux === 4 ? defiltree[source + 3] : 255
    }
  }

  return { largeur: entete.largeur, hauteur: entete.hauteur, pixels }
}

const canalLineaire = (octet) => {
  const c = octet / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export const luminance = (r, v, b) =>
  0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(v) + 0.0722 * canalLineaire(b)

export const contraste = (l1, l2) =>
  (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

/**
 * Cherche le pixel le PLUS CLAIR dans un rectangle — le pire cas pour du texte
 * clair, et le seul qui compte pour WCAG.
 *
 * ⚠ Elle ÉCHOUE BRUYAMMENT si le rectangle sort de l'image. C'est la précaution
 * la plus importante du fichier : une zone hors cadre rend des octets à zéro,
 * donc du noir parfait, donc un contraste de 21:1 sur du texte blanc — une
 * réussite éclatante et entièrement fausse. Ce défaut a déjà été payé une fois
 * sur un chantier précédent ; il ne se repaie pas.
 */
export function pireLuminance(image, rect, nom = 'zone') {
  const x0 = Math.floor(rect.x)
  const y0 = Math.floor(rect.y)
  const x1 = Math.ceil(rect.x + rect.width)
  const y1 = Math.ceil(rect.y + rect.height)

  if (x0 < 0 || y0 < 0 || x1 > image.largeur || y1 > image.hauteur) {
    throw new Error(
      `ZONE HORS CADRE — « ${nom} » : rectangle [${x0},${y0}]→[${x1},${y1}] ` +
        `hors d'une image de ${image.largeur}×${image.hauteur}. ` +
        'Du vide se lit rgb(0,0,0), soit un parfait 21:1 : la mesure serait fausse ' +
        'ET rassurante. Capturer en pleine hauteur et utiliser des coordonnées de PAGE.',
    )
  }
  if (x1 <= x0 || y1 <= y0) {
    throw new Error(`ZONE VIDE — « ${nom} » : rectangle de largeur ou hauteur nulle.`)
  }

  let pire = -1
  let pirePixel = null

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * image.largeur + x) * 4
      const l = luminance(image.pixels[i], image.pixels[i + 1], image.pixels[i + 2])
      if (l > pire) {
        pire = l
        pirePixel = [image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]]
      }
    }
  }

  return { luminance: pire, pixel: pirePixel }
}
