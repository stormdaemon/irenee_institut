import Image from "next/image";
import { EditorialBanner } from "@/components/EditorialBanner";
import { courseArtwork } from "@/lib/course-art";
import Link from "next/link";
import {ArrowUpRight,BookOpen} from "lucide-react";
import {getCourses} from "@/lib/server-data";
import {getOptionalPageProfile} from "@/lib/page-auth";
import {BuyCourseButton} from "@/components/BuyCourseButton";
import {Suspense} from "react";
export const dynamic="force-dynamic";
import { publicPageMetadata } from "@/lib/seo";
export const metadata=publicPageMetadata("Formation en apologétique catholique | Apostolos Saint Irénée", "Explorez le programme de l’Institut Apostolos Saint Irénée : apologétique, Écritures, foi et raison, histoire du christianisme et philosophie. Cours en ligne par modules.", "/formations");
export default async function FormationsPage(){
 const [courses,profile]=await Promise.all([getCourses(),getOptionalPageProfile()]);
 const isStaff=profile?.role==="directeur"||profile?.role==="formateur";
 return <div className="apostolos-wrap"><EditorialBanner image="/images/apostolos/vitrail/ecriture.webp" label="LE PROGRAMME APOSTOLOS"><h1>Le goût de comprendre.<br/><em>La joie d’apprendre.</em></h1><p>Des fondements aux grandes questions contemporaines : choisissez votre point de départ et avancez, module après module.</p></EditorialBanner><div className="apostolos-catalog-layout"><aside className="apostolos-catalog-aside"><div><span className="apostolos-label">VOTRE PARCOURS</span><h3>{courses.length} cours à explorer</h3><p>{courses.reduce((n,c)=>n+Number(c.nb_modules||0),0)} modules de formation</p></div><p>Votre espace personnel réunit les cours accessibles, vos lectures et votre progression.</p>{isStaff?<><span className="badge">Accès équipe actif</span><p>Prévisualisation sans pass</p><Link href="/espace-etudiant" className="apostolos-text-link">Ouvrir les cours <ArrowUpRight size={16}/></Link></>:<Suspense fallback={<Link href="/auth/signup">Créer mon compte</Link>}><BuyCourseButton className="apostolos-cta" label="Obtenir le pass annuel"/></Suspense>}<p>99 € conseillés, participation libre.</p></aside><div className="apostolos-catalog-list">{courses.length?courses.map((course,i)=><article className="apostolos-catalog-row apostolos-catalog-illustrated" key={course.id} id={`cours-${course.id}`}><div className="apostolos-catalog-art"><Image src={courseArtwork(course.slug).src} alt={courseArtwork(course.slug).alt} fill sizes="(max-width:520px) 100vw, 220px"/><span className="apostolos-number">{String(i+1).padStart(2,"0")}</span></div><div><span className="apostolos-label">{course.nb_modules} MODULES · {course.niveau==="avance"?"APPROFONDISSEMENT":"PARCOURS D’ÉTUDE"}</span><h2>{course.titre}</h2><p>{course.description}</p>{course.objectifs.length>0&&<details><summary>Ce que vous allez explorer</summary><ul>{course.objectifs.map((o,index)=><li key={index}>{o}</li>)}</ul></details>}<Link className="apostolos-text-link" href={profile?`/cours/${encodeURIComponent(course.slug)}`:`/auth/login?next=${encodeURIComponent(`/cours/${course.slug}`)}`}><BookOpen size={16}/>{profile?"Ouvrir le cours":"Se connecter pour étudier"}<ArrowUpRight size={16}/></Link></div></article>):<div className="apostolos-empty">Le catalogue est momentanément indisponible. Réessayez dans quelques instants.</div>}</div></div></div>;
}
