import Image from "next/image";

const networkLinks = [
  {
    label: "WikiBible",
    href: "https://wikibible.fr/",
    icon: "/images/network-icons/wikibible.png"
  },
  {
    label: "Heaven Radio",
    href: "https://heavenradio.fr/",
    icon: "/images/network-icons/heaven-radio.png"
  },
  {
    label: "La Mission",
    href: "https://www.lamissioncatholique.fr/",
    icon: "/images/network-icons/la-mission.png"
  },
  {
    label: "Ultreia",
    href: "https://ultreiaevent.com/",
    icon: "/images/network-icons/ultreia.png"
  },
  {
    label: "SOS Chrétiens",
    href: "https://soschretiensdoccident.fr/",
    icon: "/images/network-icons/sos-chretiens.png"
  },
  {
    label: "Baptême",
    href: "https://lebaptemecatholique.fr/",
    icon: "/images/network-icons/bapteme.png"
  }
];

export function FloatingNetworkMenu() {
  return (
    <aside className="floating-network" aria-label="Sites amis">
      <div className="floating-network-inner">
        {networkLinks.map(link => (
          <a className="network-link" href={link.href} target="_blank" rel="noreferrer" key={link.href}>
            <span className="network-icon">
              <Image src={link.icon} alt="" width={64} height={64} />
            </span>
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}
