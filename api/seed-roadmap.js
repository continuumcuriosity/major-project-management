// Paste this into your browser console while the Field Log app is open
// and you're signed in (so supabaseClient exists on the page).
// It bulk-inserts the roadmap nodes extracted from your research chat log,
// in chronological order, into the roadmap_items table.
// Review the array below before running — edit/remove any entries you don't want.

const seedRoadmapItems = [
  {
    "title": "Research domain selection",
    "choice": "Brain-Computer Interfaces + Energy-efficient/Green AI",
    "rationale": "Chose this pairing over other IEEE-fit options (space systems, trustworthy autonomous systems) because BCI systems are notoriously power-hungry for wearable/implantable use, making \"green AI for BCI\" a genuinely underexplored niche."
  },
  {
    "title": "Physical hardware requirement",
    "choice": "Proceed without physical device \u2014 simulation/dataset-based validation",
    "rationale": "All candidate topics (lightweight decoders, SNNs for BCI, on-device edge processing) can be validated via public datasets, software energy modeling, and simulators. An embedded-board power measurement would strengthen the paper later but isn't mandatory to start."
  },
  {
    "title": "Narrowed topic",
    "choice": "Combine multimodal fusion (EEG+EMG) with Spiking Neural Networks",
    "rationale": "Multimodal fusion papers typically use conventional CNNs while SNN papers are usually single-modality. Combining them targets a genuine gap: whether spiking architectures preserve their energy advantage when fusing heterogeneous, differently-timed signals."
  },
  {
    "title": "Confirmed literature gap",
    "choice": "EEG+EMG fusion inside a spiking architecture \u2014 does not exist yet",
    "rationale": "Literature search confirmed: EEG-to-SNN exists, EMG-to-SNN exists, EEG+EMG conventional (non-spiking) fusion exists, and SNN fusion exists for other modality pairs (audio-visual, EEG+ECG) \u2014 but no published SNN architecture fuses spike-encoded EEG and EMG together."
  },
  {
    "title": "Target venues",
    "choice": "IEEE NER and AICAS as primary targets",
    "rationale": "Both are proven fits \u2014 a near-identical theme (energy-efficient SNN for implantable BMI decoding) already appeared at AICAS 2022, and NER explicitly covers BCI decoding, neural signal processing, and neuromorphic approaches."
  },
  {
    "title": "Fusion architecture design",
    "choice": "Intermediate/hybrid fusion \u2014 two separate lanes with periodic cross-attention check-ins",
    "rationale": "Early fusion risks confusing two differently-timed signal streams; late fusion misses moment-to-moment connections between brain and muscle activity. Periodic \"check-ins\" mirror what newer multimodal spiking research does for other modality pairs."
  },
  {
    "title": "Dataset selection",
    "choice": "WAY-EEG-GAL dataset",
    "rationale": "Provides simultaneously recorded, time-locked EEG (32-channel) and EMG (5 muscles) across 3,936 grasp-and-lift trials from 12 participants \u2014 free, public, and well-precedented, removing the biggest practical blocker to starting."
  },
  {
    "title": "Reinforcement learning",
    "choice": "Not adding RL for now",
    "rationale": "The gesture/weight classification task has clear right answers \u2014 supervised learning territory. Bolting RL onto an already-novel three-part problem (encode EEG, encode EMG, fuse in spike-time) risks stalling the project with compounded failure modes. Deferred as a later, optional extension."
  },
  {
    "title": "First coding milestone",
    "choice": "Visualize raw EEG/EMG converted to spikes before building any network",
    "rationale": "Bad spike encoding poisons everything built on top of it \u2014 decided to visually confirm the spike representation looked trustworthy on one single trial before attempting any network or fusion design."
  },
  {
    "title": "EMG data source",
    "choice": "Switched from Kaggle re-upload to the official WAY-EEG-GAL release via figshare",
    "rationale": "The Kaggle \"clean\" re-upload's kin_P1.mat only had 3 smooth, slow-moving columns \u2014 diagnostic plotting confirmed it was hand-position kinematics, not the expected 5-channel EMG. The official Luciw et al. figshare release is documented to include full EMG."
  },
  {
    "title": "First real-data milestone",
    "choice": "EMG delta-spike encoding validated on real WS_P1_S1.mat trial",
    "rationale": "The spike-encoded EMG burst aligned almost exactly with the trial's LEDon/start cue (~2.2s) \u2014 independent confirmation that the pipeline correctly captures a real physiological event, not noise."
  },
  {
    "title": "EMG spike threshold tuning",
    "choice": "Locked SPIKE_THRESHOLD = 3.0",
    "rationale": "A sweep from 0.35 up to 3.5 showed lower values produced a solid, undifferentiated block of spikes; 3.0\u20133.5 produced a sparse pattern that clustered during the muscle-active window and thinned out during quiet periods."
  },
  {
    "title": "EEG channel selection",
    "choice": "Switched to motor cortex electrodes C3/C4, away from frontal Fp1",
    "rationale": "Fp1 showed a single dominating spike around 8.5\u20139s consistent with an eye blink (frontal electrodes are known to pick up eye movement). C3/C4 stayed in a clean 200\u2013800 range with no blink contamination, and are more directly tied to arm/hand movement anyway."
  },
  {
    "title": "EEG encoding baseline",
    "choice": "Z-score against each trial's own pre-LED resting period, instead of trial-wide min-max scaling",
    "rationale": "EEG never truly goes quiet, so min-max stretching made rest read as a false ~0.4 baseline and produced near-constant spiking. Z-scoring against the trial's own resting period made quiet periods correctly read as near-zero and produced honest, clustered spike bursts around the lift."
  },
  {
    "title": "Milestone 2 task definition",
    "choice": "Classify lifted object weight (light/medium/heavy) from EMG spikes using a tiny single-signal SNN",
    "rationale": "The dataset already records the weight lifted per trial, giving a natural, physiologically meaningful first classification task \u2014 heavier objects should require more muscle effort \u2014 rather than an arbitrary toy problem."
  },
  {
    "title": "Fixed dead network",
    "choice": "Raised input gain, lowered firing threshold, trained longer with a bigger learning rate",
    "rationale": "Frozen 0.43 accuracy exactly matched the biggest-class baseline \u2014 the network's neurons were never crossing their firing threshold and defaulting to guessing one class. The three fixes woke the network up (avg output spikes/trial rose from ~0 to ~250-270)."
  },
  {
    "title": "Expanded training data",
    "choice": "Pooled all 9 recording series for participant 1 (294 trials total), not just series 1 (34 trials)",
    "rationale": "With only 6 test trials, accuracy could only ever land on a handful of discrete lucky/unlucky values. Pooling all of participant 1's sessions turned \"0 out of 6\" into a far more statistically trustworthy \"0 out of 58\"."
  },
  {
    "title": "Fixed class imbalance",
    "choice": "Balanced dataset to equal counts per weight class (171 trials total, ~57 per class)",
    "rationale": "The network was exploiting the majority class (153/294 trials) as a lazy shortcut, scoring right around that 52% baseline. Balancing forced a fair 33% random baseline, revealing a genuine 0.62 test-accuracy signal."
  },
  {
    "title": "Validation methodology",
    "choice": "Switched to 5-fold cross-validation instead of a single train/test split",
    "rationale": "A single 34-trial split could swing accuracy a lot by chance \u2014 the earlier 0.62 result turned out to be partly luck. K-fold gave an honest mean \u00b1 spread instead of one roll of the dice, revealing EMG's true result as 0.43 \u00b1 0.10 and EEG's as ~chance (0.32 \u00b1 0.11)."
  },
  {
    "title": "GPU utilization fix",
    "choice": "Moved milestone 2/3 training scripts from CPU to CUDA",
    "rationale": "Scripts were running on CPU even with Kaggle's GPU accelerator enabled, because model and data tensors were never actually moved to the device. Added explicit torch.cuda.is_available() device handling to all three scripts."
  },
  {
    "title": "First fusion result",
    "choice": "Fusion (0.53) underperformed EMG-only (0.64), beat EEG-only (0.37) \u2014 a negative result",
    "rationale": "Tested EMG-only, EEG-only, and fusion on identical 5-fold splits for a fair comparison. The equal-weighting fusion mechanism let the noisy, near-random EEG lane dilute EMG's genuinely useful signal rather than adding to it."
  },
  {
    "title": "Fusion improvement \u2014 channel narrowing",
    "choice": "Restricted EEG input to 7 sensorimotor channels (FC1, FC2, C3, Cz, C4, CP1, CP2) instead of all 32",
    "rationale": "Reused the earlier C3/C4-vs-Fp1 finding to cut noisy/artifact-prone channels out of fusion. Result: fusion crept closer to EMG-only (0.57 vs 0.61) but EEG-only got no better \u2014 pointing at the fusion mechanism itself, not channel noise, as the main bottleneck."
  },
  {
    "title": "Fusion mechanism fix",
    "choice": "Implementing a learnable trust gate (adaptive alpha between EMG and EEG lanes)",
    "rationale": "A fixed 50/50 blend can only show \"blending helps\" or \"blending hurts\" with no nuance. A per-trial learned trust weight \u2014 closely related to attention, and well-precedented in published multimodal SNN fusion work \u2014 lets the network decide how much to lean on each modality, answering the sharper question of whether EEG ever genuinely helps."
  }
];

(async () => {
  for (const item of seedRoadmapItems) {
    const { error } = await supabaseClient.from('roadmap_items').insert(item);
    if (error) {
      console.error('Failed to insert:', item.title, error.message);
    } else {
      console.log('Inserted:', item.title);
    }
  }
  console.log('Done. Reopen the Roadmap tab (or click the folder icon again) to see them.');
})();