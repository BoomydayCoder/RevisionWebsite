// Editorial starter material. An empty source list and null update time distinguish
// these pages from the reader's own incorporated PDFs.
export const courses = [
  {
    id: 'algebra',
    code: '18.701',
    name: 'Algebra I',
    description: 'Groups, symmetry and bilinear forms',
    theme: 'algebra'
  },
  {
    id: 'analysis',
    code: '18.100B',
    name: 'Real Analysis',
    description: 'Limits, compactness and convergence',
    theme: 'analysis'
  },
  {
    id: 'cosmology',
    code: '8.286',
    name: 'The Early Universe',
    description: 'Expansion, freeze-out and the light elements',
    theme: 'cosmology'
  },
  {
    id: 'linguistics',
    code: '24.900',
    name: 'Introduction to Linguistics',
    description: 'Sound patterns and sentence structure',
    theme: 'linguistics'
  }
];

const starter = page => ({ ...page, sources: [], updatedAt: null });

export const notes = [
  {
    id: 'bilinear-forms',
    courseId: 'algebra',
    title: 'Bilinear forms and duality',
    summary: 'Turn a bilinear form into a map to the dual. Its kernel tells you exactly what the pairing can detect.',
    kind: 'Proof',
    sections: [
      {
        heading: 'What can the form detect?',
        body: "Fix $v$ in a finite-dimensional vector space $V$ over a field $F$. Leave the other input of the bilinear form free. What remains is a linear functional, so the form gives a map to the dual space.\n \n$$L:V\\longrightarrow V^*,\\qquad L(v)(w)=B(v,w).$$\n\nLinearity in the first argument makes $L$ linear too. Its kernel consists of the vectors that every test vector misses. So nondegeneracy in the first argument says exactly that $L$ is injective."
      },
      {
        heading: 'The matrix argument',
        body: "Choose a basis and put $M_{ij}=B(e_i,e_j)$. For coordinate columns $x$ and $y$ we have $B(x,y)=x^{\\mathsf T}My$. A fixed $x$ pairs to zero with everything precisely when each coordinate of the row $x^{\\mathsf T}M$ vanishes. Testing the basis vectors already suffices.\n\n$$B(x,y)=0\\ \\text{for all }y\\quad\\Longleftrightarrow\\quad M^{\\mathsf T}x=0.$$\n\nThe undetected first arguments form $\\ker M^{\\mathsf T}$. Testing the second argument gives $\\ker M$. The matrices are square and have the same rank, so either kernel being zero is equivalent to invertibility of $M$. This is where equal finite dimensions enter the proof."
      },
      {
        heading: 'An isotropic vector can still be detected',
        body: 'Over the reals, take B((a,b),(c,d)) = ad + bc. The vector e₁ satisfies B(e₁,e₁) = 0, yet B(e₁,e₂) = 1. Its self-pairing answers only one of the tests in the definition. Indeed the matrix exchanges the two coordinates and is its own inverse.'
      },
      {
        heading: 'Why the hyperboloid contains straight lines',
        body: "The cover drawing is the surface $q(x,y,z)=x^2+y^2-z^2=1$. Its associated symmetric form has matrix $\\operatorname{diag}(1,1,-1)$, which is invertible. Yet $w=(0,1,1)$ satisfies $q(w)=0$.\n\nTake $p=(1,0,0)$. Since $B(p,w)=0$, polarisation gives\n\n$$q(p+tw)=q(p)+2tB(p,w)+t^2q(w)=1.$$\n\nThe entire straight line $p+tw$ lies on the curved surface. Replacing $w$ by $(0,1,-1)$ gives the second line through $p$. Rotating these lines about the $z$-axis gives the two families in the drawing."
      }
    ],
    questions: [
      { question: 'For a pairing U × W → F with dim U < dim W, can every nonzero first argument be detected?', answer: 'Yes. Choose bases and pair the coordinates of U with the first dim U coordinates of W by the ordinary dot product. This detects U, while any vector of W supported only on its remaining coordinates pairs to zero. The rectangular matrix has full row rank.' },
      { question: 'How does the matrix change when the new basis vectors are the columns of P in the old basis?', answer: 'New coordinates x and y represent Px and Py in the old basis. Substitution yields xᵀ(PᵀMP)y. Since P is invertible, rank and nondegeneracy survive the change.' }
    ]
  },
  {
    id: 'class-equation-21',
    courseId: 'algebra',
    title: 'The class equation at order 21',
    summary: 'A Sylow subgroup supplies an action on six elements. Its orbits determine the entire class equation.',
    kind: 'Worked problem',
    sections: [
      {
        heading: 'Find the action',
        body: 'Let G be nonabelian of order 21. Sylow gives a unique subgroup P of order 7. Choose a subgroup Q of order 3. The product PQ has 21 elements, so P and Q generate G and Q acts on P by conjugation. This action must be nontrivial, since a trivial action would make the two cyclic subgroups commute elementwise.'
      },
      {
        heading: 'Inside the subgroup of order seven',
        body: 'Any nonidentity element of P generates P. An automorphism fixing such a generator fixes all of P. Since Q has prime order and acts nontrivially, each nonidentity element of Q acts by a nonidentity automorphism. Every nonidentity element of P consequently has Q-orbit of size 3. Conjugation by P fixes it, so the six nonidentity elements split into two G-classes of size 3.'
      },
      {
        heading: 'Outside the subgroup',
        body: 'An element g outside P has the form pq with q nonidentity. Its action on P agrees with that of q. Hence its centralizer intersects P trivially. The quotient map into G/P is injective on the centralizer, giving |C_G(g)| ≤ 3. Its image contains the nonidentity coset gP, so this centralizer has order 3.\n\nEach remaining class therefore has size 21/3 = 7. Accounting for all elements gives 21 = 1 + 3 + 3 + 7 + 7.'
      }
    ],
    questions: [
      { question: 'Why does a single fixed nonidentity element force an automorphism of P to be the identity?', answer: 'Every nonidentity element generates this cyclic group of prime order. An automorphism preserving a generator preserves all of its powers.' },
      { question: 'Which two subsets give the classes of size seven?', answer: 'The two nonidentity cosets of P. The quotient G/P is abelian, so conjugation preserves each coset, and each coset has the required seven elements.' }
    ]
  },
  {
    id: 'compactness-metric',
    courseId: 'analysis',
    title: 'Compactness in metric spaces',
    summary: 'Follow a convergent subsequence to turn a local continuity estimate into a uniform one.',
    kind: 'Proof',
    sections: [
      {
        heading: 'Two ways to use compactness',
        body: 'An open cover of a compact space has a finite subcover. In a metric space this is equivalent to every sequence having a subsequence converging to a point in the space. The cover formulation helps combine neighbourhoods; the sequence formulation helps when you can construct increasingly sharp counterexamples.'
      },
      {
        heading: 'Prove uniform continuity',
        body: 'Let f map a compact metric space K continuously into a metric space Y. Suppose uniform continuity fails. There is a fixed ε > 0 and, for each positive integer n, a pair xₙ,yₙ in K at distance less than 1/n whose images are at least ε apart. Keeping ε fixed is essential.\n\nExtract a convergent subsequence xₙₖ → x in K. The triangle inequality gives d(yₙₖ,x) ≤ d(yₙₖ,xₙₖ) + d(xₙₖ,x) → 0. Continuity now sends both subsequences to f(x), contradicting the image separation.'
      },
      {
        heading: 'Locate the failing hypothesis',
        body: 'For f(x) = 1/x on (0,1], take xₙ = 1/n and yₙ = 1/(n+1). Their distance tends to zero while their images differ by one. The two sequences approach the same missing boundary point. There is nowhere in the domain to invoke continuity at their limit.'
      }
    ],
    questions: [
      { question: 'Why must the proof use the same subsequence indices for both x and y?', answer: 'The given bound compares matched pairs. Keeping the indices together forces yₙₖ toward the same limit as xₙₖ. Independently chosen subsequences need not preserve that control.' },
      { question: 'Does closed and bounded imply compact in every metric space?', answer: 'No. An infinite set with distance one between distinct points is closed in itself and bounded. The open cover by singleton sets has no finite subcover.' }
    ]
  },
  {
    id: 'darboux-local-error',
    courseId: 'analysis',
    title: 'Budgeting the Darboux gap',
    summary: 'Separate intervals with large oscillation from intervals with large total length.',
    kind: 'Technique',
    sections: [
      {
        heading: 'Rewrite the quantity you control',
        body: 'For a bounded function f on [a,b], the upper sum minus the lower sum is the sum, over the partition intervals I, of osc(f,I) times the length of I. Here osc(f,I) is the supremum of f on I minus its infimum. Riemann integrability is equivalent to making this weighted sum arbitrarily small.'
      },
      {
        heading: 'A spike of arbitrary height',
        body: 'On [0,1] let f(c) = A > 0 at one interior point c, with f zero elsewhere. Choose partition points c−δ and c+δ inside [0,1]. The gap is at most 2Aδ, since only the interval containing c has any oscillation. Choosing δ < ε/(2A) controls the error even if the height A is enormous. The integral is zero because every lower sum is zero.'
      },
      {
        heading: 'Extend the argument to infinitely many spikes',
        body: 'Define f(p/q) = 1/q on reduced rationals in [0,1], with f zero at irrationals. Given ε > 0, choose N with 1/N < ε/2. Only finitely many rationals have denominator at most N. Enclose these in finitely many short intervals of total length less than ε/2, putting each selected rational strictly inside its interval relative to [0,1].\n\nPartition at the interval boundaries. Inside the selected intervals, oscillation is at most one. On all other pieces, every function value is at most 1/N. The total gap is less than ε. This accounts for dense spikes by separating their heights before choosing the partition.'
      }
    ],
    questions: [
      { question: 'Why put a spike in the interior of its short interval?', answer: 'Darboux sums use closed partition intervals. A spike on a shared boundary influences both neighbouring intervals. Interior placement keeps its whole contribution within the allocated length.' },
      { question: 'What changes for the indicator function of the rationals?', answer: 'Every nontrivial interval contains rationals and irrationals, so every oscillation equals one. The upper–lower gap on [0,1] is always one.' }
    ]
  },
  {
    id: 'weak-freeze-out',
    courseId: 'cosmology',
    title: 'When weak reactions freeze out',
    summary: 'Compare reaction and expansion timescales to predict when the neutron abundance leaves equilibrium.',
    kind: 'Derivation',
    sections: [
      {
        heading: 'Two competing clocks',
        body: 'In natural units, the Hubble rate H has units of inverse time, as does the conversion rate Γ per nucleon. When Γ/H is large, conversions can restore chemical equilibrium many times in an expansion time. Near Γ/H ≈ 1, the moving equilibrium abundance becomes harder to track. Freeze-out occurs over a range of temperatures.'
      },
      {
        heading: 'Follow the ratio as the universe cools',
        body: 'During radiation domination with slowly varying relativistic degrees of freedom, H grows with T². For neutron–proton weak conversion around the MeV scale, a relativistic target density proportional to T³ and a weak cross section scaling as G_F² T² give the estimate Γ ∝ G_F² T⁵. Hence Γ/H scales roughly as T³. Halving T reduces this ratio by about a factor of eight.\n\nAt a fixed temperature, increasing the radiation energy density increases H. With otherwise unchanged rates, the equality Γ ≈ H then occurs at higher T.'
      },
      {
        heading: 'Connect the timescale to abundance',
        body: 'Neglecting lepton chemical potentials and the small nucleon mass-prefactor correction, equilibrium gives nₙ/nₚ ≈ exp(−Δm/T), with Δm ≈ 1.293 MeV. A higher freeze-out temperature leaves a larger neutron-to-proton ratio. Residual reactions and free neutron decay subsequently change that ratio before nuclei form.\n\nFurther reading: Particle Data Group, review of Big Bang Nucleosynthesis, sections on weak freeze-out and deuterium formation.'
      }
    ],
    questions: [
      { question: 'If the weak coupling increases at fixed expansion history, does freeze-out move earlier or later?', answer: 'A larger reaction rate keeps Γ/H above one to a lower temperature. Freeze-out occurs later, when the equilibrium neutron-to-proton ratio is smaller.' },
      { question: 'Why compare H with a rate per nucleon?', answer: 'Both are inverse times. A reaction rate per unit volume would first have to be divided by the relevant particle density to estimate a conversion time.' }
    ]
  },
  {
    id: 'primordial-helium',
    courseId: 'cosmology',
    title: 'Counting the first helium nuclei',
    summary: 'Derive the helium mass fraction from a neutron budget and identify when that budget should be measured.',
    kind: 'Worked problem',
    sections: [
      {
        heading: 'Choose the moment to count',
        body: 'Deuterium is the first bound step toward helium. The large photon-to-baryon ratio lets the energetic tail of the photon distribution dissociate deuterium even below its binding energy. Efficient synthesis waits until the universe has cooled sufficiently. Free neutrons can decay during that delay.'
      },
      {
        heading: 'Turn a number ratio into a mass fraction',
        body: 'Just before efficient synthesis, let N and P count neutrons and protons in a fixed comoving volume. If N < P and almost every neutron goes into helium-4, there are approximately N/2 helium nuclei. The total baryon count is N + P, and about 4(N/2) baryons end up in helium.\n\nWriting r = N/P, the helium mass fraction is approximately Y = 2N/(N+P) = 2r/(1+r). At r = 1/7 this gives Y = 1/4. Replacing masses by baryon counts neglects binding energy and small nucleon mass differences.'
      },
      {
        heading: 'Check it with sixteen baryons',
        body: 'Start with two neutrons and fourteen protons. One helium nucleus uses both neutrons and two protons, leaving twelve hydrogen nuclei. Helium contains four of the sixteen baryons, yet it is only one of the thirteen surviving nuclei. The two fractions answer different observational questions.'
      }
    ],
    questions: [
      { question: 'What helium-to-hydrogen number ratio follows from r = 1/7 under these assumptions?', answer: 'There is one helium nucleus per twelve hydrogen nuclei. Algebraically, the ratio is (N/2)/(P−N) = r/[2(1−r)].' },
      { question: 'At fixed weak freeze-out abundance, how would a longer delay before efficient deuterium formation affect helium?', answer: 'More free neutrons would decay before capture. The available neutron count and the resulting helium mass fraction would fall.' }
    ]
  },
  {
    id: 'phoneme-evidence',
    courseId: 'linguistics',
    title: 'From sound patterns to phonemes',
    summary: 'Use minimal pairs and conditioning environments to test competing phonological analyses.',
    kind: 'Technique',
    sections: [
      {
        heading: 'Begin with a controlled comparison',
        body: 'A phonetic transcription in square brackets records a pronunciation. A phonemic transcription in slashes proposes a contrast in the speaker’s grammar. English pin and bin differ in the initial consonant and have different meanings. With the other segments held fixed, the pair supports separate /p/ and /b/ phonemes.'
      },
      {
        heading: 'Find what predicts the variant',
        body: 'Compare the strongly aspirated [pʰ] at the start of stressed pin with the relatively unaspirated [p] after [s] in spin in a typical English pronunciation. These are two realisations of /p/. To test this analysis, collect further /p/ tokens, recording stress, syllable position and surrounding segments. One pair of words cannot establish the whole rule.'
      },
      {
        heading: 'Ask what would change the analysis',
        body: 'Complementary distributions can arise accidentally in a small sample. Look for phonetic similarity, recurring conditioning across words, and alternations within related forms. A minimal pair differing only in aspiration in the same environment would support a contrastive aspiration distinction for that variety. The language and speaker variety are part of the hypothesis.'
      }
    ],
    questions: [
      { question: 'Are pin and spin a minimal pair for aspiration?', answer: 'No. Spin contains an additional [s], which changes the conditioning environment. The comparison illustrates contextual variation.' },
      { question: 'If two sounds never occur in the same environment in a ten-word corpus, what can you conclude?', answer: 'Their observed distributions do not overlap. A single-phoneme analysis is one hypothesis, and more data are needed to distinguish conditioning from accidental gaps.' }
    ]
  },
  {
    id: 'attachment-ambiguity',
    courseId: 'linguistics',
    title: 'One sentence, two attachments',
    summary: 'Use a single prepositional phrase to connect structural ambiguity, constituency and interpretation.',
    kind: 'Worked problem',
    sections: [
      {
        heading: 'Hold the words fixed',
        body: 'Consider “Mira photographed the statue with a drone.” On one reading, Mira used a drone to take the photograph. On another, the statue was the one accompanied by a drone. Both readings preserve the order and category of every word.'
      },
      {
        heading: 'Move one bracket',
        body: 'Instrument reading: [VP [VP photographed [NP the statue]] [PP with a drone]]. The PP modifies the photographing event.\n\nNoun-modifying reading: [VP photographed [NP [NP the statue] [PP with a drone]]]. The PP helps identify the object.\n\nThese brackets abbreviate the relevant grouping. A course-specific X′ tree can add intermediate projections while preserving the two attachment choices.'
      },
      {
        heading: 'Use substitution as a diagnostic',
        body: 'On the noun-modifying reading, “the statue with a drone” can be replaced as a whole by “it”. On the instrument reading, “Mira photographed it with a drone” preserves the instrument while replacing “the statue”. The diagnostic is most informative when you specify which meaning the substitution should preserve.'
      }
    ],
    questions: [
      { question: 'Which interpretation survives most naturally in “Mira did so with a drone”, if “did so” stands for “photographed the statue”?', answer: 'The instrument reading. The final PP can attach to the event referred to by “did so”. On the noun-modifying reading the PP belongs inside the object constituent.' },
      { question: 'Why can part-of-speech labels alone miss this ambiguity?', answer: 'Both analyses have the same sequence of lexical categories. The attachment site changes which constituent the PP modifies.' }
    ]
  }
].map(starter);
