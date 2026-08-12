export type PreplanPhoneType = "Cell" | "Work";

export type PreplanContactPhone = {
  id: string;
  type: PreplanPhoneType;
  number: string;
};

export type PreplanContact = {
  id: string;
  name: string;
  phones: PreplanContactPhone[];
};

let contactSequence = 0;

function nextId(prefix: string) {
  contactSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${contactSequence.toString(36)}`;
}

export function createPreplanPhone(type: PreplanPhoneType = "Cell", number = ""): PreplanContactPhone {
  return { id: nextId("phone"), type, number };
}

export function createPreplanContact(name = "", phones: PreplanContactPhone[] = [createPreplanPhone()]): PreplanContact {
  return { id: nextId("contact"), name, phones };
}

export function parsePreplanContacts(value: string): PreplanContact[] {
  if (!value.trim()) return [createPreplanContact()];

  return value.split(/\r?\n\s*•\s*\r?\n/).map((block) => {
    const nameLines: string[] = [];
    const phones: PreplanContactPhone[] = [];

    for (const line of block.split(/\r?\n/)) {
      const phone = line.match(/^\s*(Cell|Work)\s*:\s*(.*)$/i);
      if (phone) {
        const type: PreplanPhoneType = phone[1].toLowerCase() === "work" ? "Work" : "Cell";
        phones.push(createPreplanPhone(type, phone[2].trim()));
      } else {
        nameLines.push(line);
      }
    }

    return createPreplanContact(nameLines.join("\n").trim(), phones.length ? phones : [createPreplanPhone()]);
  });
}

export function serializePreplanContacts(contacts: PreplanContact[]): string {
  return contacts
    .map((contact) => {
      const name = contact.name.trim();
      const phones = contact.phones
        .filter((phone) => phone.number.trim())
        .map((phone) => `${phone.type}: ${phone.number.trim()}`);
      return [name, ...phones].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n•\n");
}
