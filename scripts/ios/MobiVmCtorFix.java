import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

/**
 * Appels que l'audit de forge-gui-ios (MobiVmLinkAudit) ne voit pas : il cherche un constructeur aussi dans les
 * classes parentes, or un constructeur ne s'hérite pas. Sur MobiVM, Exception, RuntimeException et Error n'ont pas
 * le constructeur protégé (String, Throwable, boolean, boolean) de Java 7 (seul Throwable l'a) : un appel
 * super(message, cause, false, false) devient un NoSuchMethodError à l'exécution (AITimeoutTracker$Expired de
 * Forge, lancé quand l'IA dépasse son temps de réflexion).
 *
 * Ce programme réécrit ces appels vers (String, Throwable) en laissant tomber les deux booléens (l'exception garde
 * sa pile d'appels, sans autre effet), puis vérifie chaque appel restant : constructeur sur la classe exacte,
 * méthode statique ou non comme l'appel l'attend, membre privé appelé d'une autre classe. Dans notre propre code
 * (atclaude/*), toute méthode ou classe introuvable compte aussi. Tout appel cassé est listé après CTOR-GATE-FAIL
 * (code de sortie 2) ; ailleurs, les méthodes introuvables sont seulement notées (MobiVmLinkAudit les rapporte).
 *
 * Usage : MobiVmCtorFix --index a.jar,b.jar,... [--defer prefixe/] (--in x.jar --out y.jar | --scan z.jar)...
 *   --index : tous les jars de l'application et de MobiVM (comme pour MobiVmBridge)
 *   --defer : classes compilées plus tard (forge/compat/ avant le module ios), pas encore vérifiables
 *   --in/--out : jars à corriger (--out peut être le même fichier que --in)
 *   --scan : jars déjà corrigés, seulement vérifiés
 */
public class MobiVmCtorFix {
    static final String FOUR = "(Ljava/lang/String;Ljava/lang/Throwable;ZZ)V";
    static final String TWO = "(Ljava/lang/String;Ljava/lang/Throwable;)V";

    static final class ClassInfo {
        String superName;
        String[] interfaces;
        final Map<String, Integer> methods = new HashMap<>(); // nom + descripteur -> accès
    }

    static final Map<String, ClassInfo> INDEX = new HashMap<>();
    static final Map<String, List<String>> BROKEN = new TreeMap<>();
    static final Map<String, List<String>> NOTES = new TreeMap<>();
    static final Map<String, List<String>> FIXED = new TreeMap<>();
    /** Notre code (pont, module ios) : tout appel sans cible y fait échouer la construction. */
    static final String OWN = "atclaude/";
    static int fixed;
    static final List<String> DEFER = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        List<String> index = new ArrayList<>(), ins = new ArrayList<>(), outs = new ArrayList<>(),
                scans = new ArrayList<>();
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--index": for (String s : args[++i].split(",")) if (!s.isEmpty()) index.add(s); break;
                case "--in": ins.add(args[++i]); break;
                case "--out": outs.add(args[++i]); break;
                case "--scan": scans.add(args[++i]); break;
                case "--defer": DEFER.add(args[++i]); break;
                default: throw new IllegalArgumentException(args[i]);
            }
        }
        if (ins.size() != outs.size()) throw new IllegalArgumentException("--in and --out come in pairs");
        for (String j : index) indexJar(j);
        for (int i = 0; i < ins.size(); i++) fixJar(ins.get(i), outs.get(i));
        int before = fixed;
        for (String j : scans) fixJar(j, null);
        if (fixed != before) {
            broken("UNFIXED " + (fixed - before) + " call(s) still to rewrite in --scan jars", String.join(", ", scans));
        }
        System.out.println("CTOR-FIX: " + fixed + " call(s) rewritten");
        for (Map.Entry<String, List<String>> e : FIXED.entrySet()) {
            System.out.println("FIXED " + e.getKey() + "  <- " + String.join(", ", e.getValue()));
        }
        for (Map.Entry<String, List<String>> e : NOTES.entrySet()) {
            System.out.println("NOTE " + e.getKey() + "  <- " + e.getValue().size() + " refs, ex. " + e.getValue().get(0));
        }
        if (BROKEN.isEmpty()) {
            System.out.println("CTOR-CHECK CLEAN");
            return;
        }
        System.out.println("CTOR-GATE-FAIL: " + BROKEN.size() + " call(s) without a target on MobiVM");
        for (Map.Entry<String, List<String>> e : BROKEN.entrySet()) {
            System.out.println(e.getKey() + "  <- " + String.join(", ", e.getValue()));
        }
        System.exit(2);
    }

    static void indexJar(String path) throws IOException {
        try (ZipFile zf = new ZipFile(path)) {
            for (Enumeration<? extends ZipEntry> en = zf.entries(); en.hasMoreElements(); ) {
                ZipEntry e = en.nextElement();
                String n = e.getName();
                if (!n.endsWith(".class") || n.startsWith("META-INF/") || n.endsWith("module-info.class")) continue;
                try (InputStream is = zf.getInputStream(e)) {
                    ClassReader cr = new ClassReader(is);
                    if (INDEX.containsKey(cr.getClassName())) continue; // premier trouvé, comme le chargeur
                    ClassInfo ci = new ClassInfo();
                    ci.superName = cr.getSuperName();
                    ci.interfaces = cr.getInterfaces();
                    cr.accept(new ClassVisitor(Opcodes.ASM9) {
                        @Override
                        public MethodVisitor visitMethod(int acc, String name, String desc, String sig, String[] ex) {
                            ci.methods.put(name + desc, acc);
                            return null;
                        }
                    }, ClassReader.SKIP_CODE | ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);
                    INDEX.put(cr.getClassName(), ci);
                }
            }
        }
    }

    /** Déclarant d'une méthode (pas d'un constructeur) : la classe, ses parents puis les interfaces. */
    static String resolve(String owner, String nameDesc) {
        Set<String> seen = new HashSet<>();
        for (String c = owner; c != null; ) {
            ClassInfo ci = INDEX.get(c);
            if (ci == null) return null;
            if (ci.methods.containsKey(nameDesc)) return c;
            seen.add(c);
            c = ci.superName;
        }
        List<String> work = new ArrayList<>();
        for (String c = owner; c != null; c = INDEX.containsKey(c) ? INDEX.get(c).superName : null) {
            String[] itf = INDEX.get(c).interfaces;
            if (itf != null) for (String i : itf) work.add(i);
        }
        while (!work.isEmpty()) {
            String c = work.remove(work.size() - 1);
            ClassInfo ci = INDEX.get(c);
            if (ci == null || !seen.add(c)) continue;
            if (ci.methods.containsKey(nameDesc)) return c;
            if (ci.interfaces != null) for (String i : ci.interfaces) work.add(i);
        }
        return null;
    }

    static void broken(String key, String where) {
        BROKEN.computeIfAbsent(key, k -> new ArrayList<>()).add(where);
    }

    static boolean deferred(String owner) {
        for (String p : DEFER) if (owner.startsWith(p)) return true;
        return false;
    }

    static void note(String key, String where) {
        NOTES.computeIfAbsent(key, k -> new ArrayList<>()).add(where);
    }

    /**
     * Constructeurs Java 7 ou 8 absents de MobiVM, appelés par des bibliothèques sur des chemins que l'application
     * n'emprunte pas (jgrapht, téléchargeur de Forge) : remplacés quand même, pour qu'aucun ne puisse planter.
     */
    static final Map<String, String> REWRITES = new HashMap<>();
    static {
        // PriorityQueue(Comparator) -> PriorityQueue(11, Comparator), la capacité par défaut
        REWRITES.put("java/util/PriorityQueue.<init>(Ljava/util/Comparator;)V", "(ILjava/util/Comparator;)V");
        // ZipFile(String, Charset) -> ZipFile(String) : noms d'entrées en UTF-8, comme le défaut
        REWRITES.put("java/util/zip/ZipFile.<init>(Ljava/lang/String;Ljava/nio/charset/Charset;)V", "(Ljava/lang/String;)V");
    }

    static void rewrite(MethodVisitor mv, int op, String owner, String desc, boolean itf) {
        if (desc.startsWith("(I")) { // ..., comparateur -> ..., 11, comparateur
            mv.visitIntInsn(Opcodes.BIPUSH, 11);
            mv.visitInsn(Opcodes.SWAP);
        } else { // le jeu de caractères en trop
            mv.visitInsn(Opcodes.POP);
        }
        mv.visitMethodInsn(op, owner, "<init>", desc, itf);
    }

    static void fixJar(String in, String out) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        try (ZipFile zf = new ZipFile(in); ZipOutputStream zout = new ZipOutputStream(buf)) {
            for (Enumeration<? extends ZipEntry> en = zf.entries(); en.hasMoreElements(); ) {
                ZipEntry e = en.nextElement();
                byte[] data;
                try (InputStream is = zf.getInputStream(e)) {
                    data = is.readAllBytes();
                }
                String n = e.getName();
                if (n.endsWith(".class") && !n.startsWith("META-INF/") && !n.endsWith("module-info.class")) {
                    data = fixClass(data);
                }
                ZipEntry ne = new ZipEntry(n);
                ne.setTime(e.getTime());
                zout.putNextEntry(ne);
                zout.write(data);
                zout.closeEntry();
            }
        }
        if (out == null) return;
        try (FileOutputStream fo = new FileOutputStream(out)) {
            buf.writeTo(fo);
        }
    }

    static byte[] fixClass(byte[] data) {
        ClassReader cr = new ClassReader(data);
        String self = cr.getClassName();
        int[] count = {0};
        // Frames gardées telles quelles : chaque réécriture laisse la pile comme l'appel d'origine après lui.
        // Seule la hauteur maximale peut grandir (le 11 de PriorityQueue), d'où COMPUTE_MAXS.
        ClassWriter cw = new ClassWriter(cr, ClassWriter.COMPUTE_MAXS);
        cr.accept(new ClassVisitor(Opcodes.ASM9, cw) {
            @Override
            public MethodVisitor visitMethod(int acc, String mname, String mdesc, String sig, String[] ex) {
                String where = self + "." + mname;
                return new MethodVisitor(Opcodes.ASM9, super.visitMethod(acc, mname, mdesc, sig, ex)) {
                    @Override
                    public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                        ClassInfo ci = owner.startsWith("[") ? null : INDEX.get(owner);
                        if (ci == null) { // tableau, ou classe absente (rapportée par MobiVmLinkAudit)
                            if (!owner.startsWith("[") && self.startsWith(OWN) && !deferred(owner)) {
                                broken("CLASS " + owner, where);
                            }
                            super.visitMethodInsn(op, owner, name, desc, itf);
                            return;
                        }
                        String fix = REWRITES.get(owner + "." + name + desc);
                        if (fix != null) {
                            rewrite(mv, op, owner, fix, itf);
                            FIXED.computeIfAbsent(owner + "." + name + desc, k -> new ArrayList<>()).add(where);
                            count[0]++;
                            return;
                        }
                        if ("<init>".equals(name)) {
                            if (!ci.methods.containsKey(name + desc)) {
                                if (FOUR.equals(desc) && ci.methods.containsKey(name + TWO)) {
                                    super.visitInsn(Opcodes.POP2);
                                    super.visitMethodInsn(op, owner, name, TWO, itf);
                                    FIXED.computeIfAbsent(owner + "." + name + desc, k -> new ArrayList<>()).add(where);
                                    count[0]++;
                                    return;
                                }
                                broken("CTOR " + owner + "." + name + desc, where);
                            }
                        } else {
                            String decl = resolve(owner, name + desc);
                            if (decl != null) {
                                int access = INDEX.get(decl).methods.get(name + desc);
                                boolean isStatic = (access & Opcodes.ACC_STATIC) != 0;
                                if (isStatic != (op == Opcodes.INVOKESTATIC)) {
                                    broken((isStatic ? "STATIC " : "INSTANCE ") + owner + "." + name + desc, where);
                                } else if ((access & Opcodes.ACC_PRIVATE) != 0 && !decl.equals(self)
                                        && !samePackageNest(decl, self)) {
                                    broken("PRIVATE " + decl + "." + name + desc, where);
                                }
                            }
                            else if (self.startsWith(OWN)) {
                                broken("METHOD " + owner + "." + name + desc, where);
                            } else {
                                note("METHOD " + owner + "." + name + desc, where);
                            }
                        }
                        super.visitMethodInsn(op, owner, name, desc, itf);
                    }
                };
            }
        }, 0);
        if (count[0] == 0) return data;
        fixed += count[0];
        return cw.toByteArray();
    }

    /** Classes imbriquées (Java 11+, ramenées en Java 8) : même classe englobante, accès privé permis. */
    static boolean samePackageNest(String a, String b) {
        int ia = a.indexOf('$'), ib = b.indexOf('$');
        String ra = ia < 0 ? a : a.substring(0, ia), rb = ib < 0 ? b : b.substring(0, ib);
        return ra.equals(rb);
    }
}
